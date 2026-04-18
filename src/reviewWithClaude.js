const Anthropic = require("@anthropic-ai/sdk");

const MODEL = "claude-sonnet-4-20250514";

const SYSTEM_PROMPT = [
  "You are a senior software engineer reviewing a pull request diff.",
  "Give pragmatic, actionable feedback and be technically precise.",
  "You must format the response with exactly these sections and headings:",
  "1. **Summary**",
  "2. **Issues**",
  "3. **Suggestions**",
  "4. **Positives**",
  "5. **Overall verdict**",
  "In Issues, include bugs, logic errors, and security risks only. Prefix warnings with ⚠️.",
  "In Suggestions, include non-blocking improvements and style tips. Prefix tips with 💡.",
  "In Positives, list what is done well. Prefix positives with ✅.",
  "Overall verdict must be exactly one of: ✅ Approve | 🔁 Request Changes | 💬 Comment.",
  "If there are no issues, explicitly state that there are no blocking issues and do not invent problems."
].join("\n");

function createAnthropicClient(apiKey) {
  return new Anthropic({ apiKey });
}

async function reviewWithClaude({ anthropicApiKey, diff }) {
  const client = createAnthropicClient(anthropicApiKey);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Review this pull request diff:\n\n${diff}`
          }
        ]
      }
    ]
  });

  const textBlocks = Array.isArray(response.content)
    ? response.content.filter((item) => item.type === "text").map((item) => item.text)
    : [];

  const reviewText = textBlocks.join("\n\n").trim();
  if (!reviewText) {
    throw new Error("Claude returned an empty review response.");
  }

  return {
    reviewText,
    model: MODEL
  };
}

module.exports = {
  reviewWithClaude,
  MODEL
};
