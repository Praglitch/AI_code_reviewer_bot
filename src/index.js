const core = require("@actions/core");
const github = require("@actions/github");
const { Octokit } = require("@octokit/rest");
require("dotenv").config();

const { getDiff } = require("./getDiff");
const { filterDiff } = require("./filterDiff");
const { reviewWithGroq } = require("./reviewWithGroq");
const { buildCommentBody, postOrUpdateComment } = require("./postComment");

function getPullRequestContext() {
  const context = github.context;
  const pr = context.payload.pull_request;

  if (pr && context.repo && context.repo.owner && context.repo.repo) {
    return {
      owner: context.repo.owner,
      repo: context.repo.repo,
      pullNumber: pr.number,
      baseRef: pr.base && pr.base.ref
    };
  }

  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const pullNumberRaw = process.env.GITHUB_PULL_NUMBER;
  const pullNumber = Number.parseInt(pullNumberRaw || "", 10);

  if (!owner || !repo || !Number.isInteger(pullNumber) || pullNumber <= 0) {
    throw new Error(
      "Missing pull request context. In GitHub Actions, run on pull_request events. For local runs, set GITHUB_OWNER, GITHUB_REPO, and GITHUB_PULL_NUMBER."
    );
  }

  return {
    owner,
    repo,
    pullNumber,
    baseRef: process.env.GITHUB_BASE_REF || null
  };
}

function getExecutionContext() {
  const token = process.env.GITHUB_TOKEN;
  const groqApiKey = process.env.GROQ_API_KEY;

  if (!token) {
    throw new Error("Missing required environment variable: GITHUB_TOKEN");
  }

  if (!groqApiKey) {
    throw new Error("Missing required environment variable: GROQ_API_KEY");
  }

  const prContext = getPullRequestContext();

  if (prContext.baseRef && prContext.baseRef !== "main") {
    return {
      skip: true,
      reason: `Skipping review because PR targets '${prContext.baseRef}', not 'main'.`
    };
  }

  return {
    skip: false,
    token,
    groqApiKey,
    owner: prContext.owner,
    repo: prContext.repo,
    pullNumber: prContext.pullNumber
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

    // Ask Groq to generate a structured review for the filtered diff.
    const review = await reviewWithGroq({
      groqApiKey: execution.groqApiKey,
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
