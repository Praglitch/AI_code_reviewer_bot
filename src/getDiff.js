const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".ico",
  ".tiff",
  ".svgz",
  ".pdf",
  ".zip",
  ".gz",
  ".tar",
  ".7z",
  ".rar",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".mp3",
  ".mp4",
  ".avi",
  ".mov",
  ".webm",
  ".wasm",
  ".exe",
  ".dll",
  ".so",
  ".dylib"
]);

function getExtension(filePath) {
  const idx = filePath.lastIndexOf(".");
  if (idx === -1) {
    return "";
  }
  return filePath.slice(idx).toLowerCase();
}

function looksBinaryFile(file) {
  const extension = getExtension(file.filename || "");
  if (BINARY_EXTENSIONS.has(extension)) {
    return true;
  }

  // GitHub omits patch for binary files and sometimes very large files.
  if (!file.patch || typeof file.patch !== "string") {
    return true;
  }

  return false;
}

async function getDiff({ octokit, owner, repo, pullNumber }) {
  const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100
  });

  const normalizedFiles = files.map((file) => {
    const patch = typeof file.patch === "string" ? file.patch : "";
    return {
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      patch,
      binary: looksBinaryFile(file)
    };
  });

  return {
    files: normalizedFiles,
    totalFiles: normalizedFiles.length
  };
}

module.exports = {
  getDiff,
  looksBinaryFile
};
