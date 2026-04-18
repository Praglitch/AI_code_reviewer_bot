# AI PR Code Reviewer (Gemini + GitHub Actions)

Automatically reviews pull requests with Google Gemini and posts a structured review comment directly on the PR.

## 1. What it does

- Triggers when a pull request to `main` is opened, reopened, or updated.
- Fetches the PR file patches via GitHub API.
- Filters out lock files, generated/build output, minified files, and binary files.
- Sends reviewable diff content to Gemini model `gemini-2.0-flash`.
- Posts one structured PR comment and updates it on subsequent runs.

Screenshot placeholder:

![AI review comment screenshot placeholder](docs/screenshot-placeholder.png)

## 2. Setup (fork -> add secret -> done)

1. Fork this repository.
2. In your fork, go to **Settings -> Secrets and variables -> Actions**.
3. Add a new repository secret:
   - Name: `GEMINI_API_KEY`
   - Value: your Gemini API key (from Google AI Studio)
4. Ensure the workflow file exists at `.github/workflows/ai-review.yml`.
5. Open or update a pull request targeting `main`.
6. The workflow runs automatically and posts/updates the AI review comment.

Notes:

- `GITHUB_TOKEN` is provided automatically by GitHub Actions.
- Works for public and private repositories when secrets and permissions are configured.
- Optional: set `FAIL_ON_AI_ERROR=true` if you want provider/API errors to fail the workflow.

## 3. How to customize the review prompt

Edit the system prompt in `src/reviewWithGemini.js`:

- Update the `SYSTEM_PROMPT` constant.
- Keep the required section headings if you still want the exact structured output format.
- You can tune strictness, focus areas (security/performance/testing), and tone.

## 4. How to add/remove file filters

Edit filter logic in `src/filterDiff.js`:

- `LOCK_FILES` set controls exact lock files excluded.
- `EXCLUDED_DIRECTORIES` controls excluded folders.
- `.min.js` and binary extension checks are in `shouldExcludeFile`.
- Adjust `maxChars` value in `src/index.js` to change the truncation limit (default 12000).

## 5. Cost estimate (approx Gemini API cost per PR review)

Approximate per-review cost depends on diff size and output length.

Example ballpark (subject to Google pricing changes):

- Small PR (2k-4k chars diff): roughly a few cents.
- Medium PR (8k-12k chars diff): roughly $0.05-$0.30.
- Large PRs may be truncated to control token usage.

Recommendation:

- Keep truncation enabled.
- Exclude generated and lock files.
- Monitor usage in the Google AI Studio / Gemini billing dashboard.

## 6. Troubleshooting (common errors)

### Error: Missing required environment variable: GEMINI_API_KEY

- Add `GEMINI_API_KEY` in repository secrets.
- Verify workflow is running in a context where secrets are available.

### Error: AI review failed: 401 / authentication

- API key is invalid or revoked.
- Regenerate key in Google AI Studio and update repository secret.

### Error: AI review failed: 429 / quota exceeded

- This means your Gemini project currently has no available free-tier quota or has hit limits.
- The action now posts a warning comment and continues by default.
- If you want this to fail CI, set `FAIL_ON_AI_ERROR=true` in workflow env.

### Error: No reviewable code changes found

- PR only changed excluded files (lock/build/generated/minified/binary).
- Update filters in `src/filterDiff.js` if needed.

### Duplicate comments

- This action updates existing bot comments with the header `## 🤖 AI Code Review`.
- If header was changed manually, the action may create a new comment.

### Workflow does not run

- Confirm PR targets `main`.
- Confirm event type is one of opened/synchronize/reopened.
- Confirm workflow file is on default branch.

Trigger note: test change to run AI PR review workflow.
