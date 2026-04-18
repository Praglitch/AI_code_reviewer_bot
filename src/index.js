const core = require("@actions/core");
const github = require("@actions/github");
const { Octokit } = require("@octokit/rest");
require("dotenv").config();

const { getDiff } = require("./getDiff");
const { filterDiff } = require("./filterDiff");
const { reviewWithGemini } = require("./reviewWithGemini");
const { buildCommentBody, postOrUpdateComment } = require("./postComment");

function getExecutionContext() {
  const token = process.env.GITHUB_TOKEN;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!token) {
    throw new Error("Missing required environment variable: GITHUB_TOKEN");
  }

  if (!geminiApiKey) {
    throw new Error("Missing required environment variable: GEMINI_API_KEY");
  }

  const context = github.context;
  const repoInfo = context.repo;
  const pr = context.payload.pull_request;

  if (!pr) {
    throw new Error("This action only runs on pull_request events.");
  }

  if (pr.base && pr.base.ref !== "main") {
    return {
      skip: true,
      reason: `Skipping review because PR targets '${pr.base.ref}', not 'main'.`
    };
  }

  return {
    skip: false,
    token,
    geminiApiKey,
    owner: repoInfo.owner,
    repo: repoInfo.repo,
    pullNumber: pr.number
  };
}

async function run() {
  try {
    // Validate required runtime values and pull request context first.
    const execution = getExecutionContext();
    if (execution.skip) {
      core.info(execution.reason);
      return;
    }

    // Use Octokit REST directly for all GitHub API calls.
    const octokit = new Octokit({ auth: execution.token });

    core.info(
      `Starting AI review for ${execution.owner}/${execution.repo}#${execution.pullNumber}`
    );

    const diffResult = await getDiff({
      octokit,
      owner: execution.owner,
      repo: execution.repo,
      pullNumber: execution.pullNumber
    });

    const filtered = filterDiff(diffResult.files, 12000);

    if (!filtered.diff) {
      // No reviewable source changes remain after filtering.
      const noDiffBody = buildCommentBody({
        content: "No reviewable code changes found.",
        truncated: false,
        originalLength: 0
      });

      await postOrUpdateComment({
        octokit,
        owner: execution.owner,
        repo: execution.repo,
        issueNumber: execution.pullNumber,
        body: noDiffBody
      });

      core.info("No reviewable changes detected. Posted skip message.");
      return;
    }

    // Ask Gemini to generate a structured review for the filtered diff.
    const review = await reviewWithGemini({
      geminiApiKey: execution.geminiApiKey,
      diff: filtered.diff
    });

    const reviewBody = buildCommentBody({
      content: review.reviewText,
      truncated: filtered.truncated,
      originalLength: filtered.originalLength
    });

    const commentResult = await postOrUpdateComment({
      octokit,
      owner: execution.owner,
      repo: execution.repo,
      issueNumber: execution.pullNumber,
      body: reviewBody
    });

    core.info(
      commentResult.updated
        ? `Updated existing AI review comment (${commentResult.commentId}).`
        : `Posted new AI review comment (${commentResult.commentId}).`
    );
  } catch (error) {
    console.error("AI review pipeline failed:", error);

    try {
      // Try to post a fallback PR comment so reviewers still get context.
      const token = process.env.GITHUB_TOKEN;
      const context = github.context;
      const pr = context.payload.pull_request;

      if (token && pr) {
        const octokit = new Octokit({ auth: token });
        const failureBody = buildCommentBody({
          content: `⚠️ AI review failed: ${error.message}. Please review manually.`,
          truncated: false,
          originalLength: 0
        });

        await postOrUpdateComment({
          octokit,
          owner: context.repo.owner,
          repo: context.repo.repo,
          issueNumber: pr.number,
          body: failureBody
        });
      }
    } catch (commentError) {
      console.error("Failed to post fallback failure comment:", commentError);
    }

    const failOnAiError = process.env.FAIL_ON_AI_ERROR === "true";
    if (failOnAiError) {
      core.setFailed(error.message);
      return;
    }

    core.warning(`AI review failed but workflow is continuing: ${error.message}`);
  }
}

run();
