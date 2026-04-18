const OpenAI = require("openai");

const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

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

function createGroqClient(apiKey) {
  return new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1"
  });
}

async function reviewWithGroq({ groqApiKey, diff }) {
  const client = createGroqClient(groqApiKey);

  const response = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Review this pull request diff:\n\n${diff}` }
    ]
  });

  const reviewText = (response.choices?.[0]?.message?.content || "").trim();

  if (!reviewText) {
    throw new Error("Groq returned an empty review response.");
  }

  return {
    reviewText,
    model: MODEL
  };
}

module.exports = {
  reviewWithGroq,
  MODEL
};
