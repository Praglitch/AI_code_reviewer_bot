const { GoogleGenerativeAI } = require("@google/generative-ai");

const MODEL = "gemini-2.0-flash";

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

function createGeminiClient(apiKey) {
  return new GoogleGenerativeAI(apiKey);
}

async function reviewWithGemini({ geminiApiKey, diff }) {
  const genAI = createGeminiClient(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: MODEL });

  const result = await model.generateContent([
    { text: SYSTEM_PROMPT },
    { text: `Review this pull request diff:\n\n${diff}` }
  ]);

  const reviewText = result.response.text().trim();

  if (!reviewText) {
    throw new Error("Gemini returned an empty review response.");
  }

  return {
    reviewText,
    model: MODEL
  };
}

module.exports = {
  reviewWithGemini,
  MODEL
};
