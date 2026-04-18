const LOCK_FILES = new Set(["package-lock.json", "yarn.lock", "pnpm-lock.yaml"]);
const EXCLUDED_DIRECTORIES = ["dist/", "build/", "generated/"];
const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".ico",
  ".tiff",
  ".pdf",
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
  ".zip",
  ".tar",
  ".gz",
  ".rar",
  ".7z"
]);

function getExtension(filePath) {
  const idx = filePath.lastIndexOf(".");
  if (idx === -1) {
    return "";
  }
  return filePath.slice(idx).toLowerCase();
}

function shouldExcludeFile(file) {
  const normalized = (file.filename || "").replace(/\\/g, "/").toLowerCase();

  if (!normalized) {
    return true;
  }

  if (LOCK_FILES.has(normalized.split("/").pop())) {
    return true;
  }

  if (EXCLUDED_DIRECTORIES.some((dir) => normalized.includes(`/${dir}`) || normalized.startsWith(dir))) {
    return true;
  }

  if (normalized.endsWith(".min.js")) {
    return true;
  }

  if (BINARY_EXTENSIONS.has(getExtension(normalized))) {
    return true;
  }

  if (file.binary) {
    return true;
  }

  return false;
}

function toUnifiedDiffChunk(file) {
  return [
    `diff --git a/${file.filename} b/${file.filename}`,
    `--- a/${file.filename}`,
    `+++ b/${file.filename}`,
    file.patch.trimEnd(),
    ""
  ].join("\n");
}

function filterDiff(files, maxChars = 12000) {
  const reviewableFiles = files.filter((file) => !shouldExcludeFile(file) && file.patch);

  if (reviewableFiles.length === 0) {
    return {
      diff: "",
      reviewableFilesCount: 0,
      truncated: false,
      originalLength: 0
    };
  }

  const fullDiff = reviewableFiles.map(toUnifiedDiffChunk).join("\n");
  if (fullDiff.length <= maxChars) {
    return {
      diff: fullDiff,
      reviewableFilesCount: reviewableFiles.length,
      truncated: false,
      originalLength: fullDiff.length
    };
  }

  const truncatedDiff = `${fullDiff.slice(0, maxChars)}\n\n[... diff truncated due to size limit ...]`;
  return {
    diff: truncatedDiff,
    reviewableFilesCount: reviewableFiles.length,
    truncated: true,
    originalLength: fullDiff.length
  };
}

module.exports = {
  filterDiff,
  shouldExcludeFile
};
