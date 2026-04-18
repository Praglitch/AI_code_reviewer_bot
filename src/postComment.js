const REVIEW_HEADER = "## 🤖 AI Code Review";
const REVIEW_FOOTER = "_Powered by Claude claude-sonnet-4-20250514 — review suggestions, don't blindly apply them._";

function buildCommentBody({ content, truncated, originalLength }) {
  const sections = [REVIEW_HEADER, ""];

  if (truncated) {
    sections.push(
      `⚠️ Diff exceeded the size limit and was truncated before review (original length: ${originalLength} characters).`,
      ""
    );
  }

  sections.push(content.trim(), "", REVIEW_FOOTER);
  return sections.join("\n");
}

async function findExistingAiComment({ octokit, owner, repo, issueNumber }) {
  const comments = await octokit.paginate(octokit.rest.issues.listComments, {
    owner,
    repo,
    issue_number: issueNumber,
    per_page: 100
  });

  return comments.find((comment) => {
    const body = comment.body || "";
    const isBot = comment.user && comment.user.type === "Bot";
    return isBot && body.includes(REVIEW_HEADER);
  });
}

async function postOrUpdateComment({ octokit, owner, repo, issueNumber, body }) {
  const existingComment = await findExistingAiComment({
    octokit,
    owner,
    repo,
    issueNumber
  });

  if (existingComment) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existingComment.id,
      body
    });
    return { updated: true, commentId: existingComment.id };
  }

  const created = await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body
  });

  return { updated: false, commentId: created.data.id };
}

module.exports = {
  REVIEW_HEADER,
  REVIEW_FOOTER,
  buildCommentBody,
  postOrUpdateComment
};
