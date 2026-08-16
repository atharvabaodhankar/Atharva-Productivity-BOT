const Groq = require("groq-sdk");
const { GROQ_API_KEYS } = require("../config/env");

let currentKeyIndex = 0;

const FALLBACK_MODELS = [
  "qwen/qwen3.6-27b",
  "openai/gpt-oss-120b",
  "gpt-oss-120b",
  "llama-3.3-70b-versatile",
  "llama-3.1-70b-versatile",
  "llama-3.1-8b-instant",
  "deepseek-r1-distill-llama-70b",
  "mixtral-8x7b-32768",
  "gemma2-9b-it",
];

function getNextClient() {
  if (!GROQ_API_KEYS || GROQ_API_KEYS.length === 0) {
    throw new Error("No Groq API keys configured. Set GROQ_API_KEY environment variable.");
  }

  const key = GROQ_API_KEYS[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % GROQ_API_KEYS.length;
  return new Groq({ apiKey: key });
}

async function executeWithFailover(createParams) {
  const primaryModel = createParams.model || "qwen/qwen3.6-27b";

  // Build model fallback sequence
  const modelsToTry = [
    primaryModel,
    ...FALLBACK_MODELS.filter((m) => m !== primaryModel),
  ];

  let lastError = null;

  for (const model of modelsToTry) {
    const params = { ...createParams, model };
    const totalKeys = Math.max(1, GROQ_API_KEYS.length);

    for (let attempt = 0; attempt < totalKeys; attempt++) {
      try {
        const client = getNextClient();
        return await client.chat.completions.create(params);
      } catch (err) {
        lastError = err;
        const isRateLimit =
          err.status === 429 ||
          (err.message && (err.message.includes("429") || err.message.includes("rate_limit") || err.message.includes("tokens per day")));

        console.warn(
          `Groq request failed on model '${model}' (key attempt ${attempt + 1}/${totalKeys}): ${err.message}. ${
            isRateLimit ? "Rate limit detected. Rotating model/key..." : "Rotating..."
          }`
        );

        // If rate limit (429 / TPD limit) occurs, switch models faster after 2 key attempts
        if (isRateLimit && attempt >= 1) {
          console.warn(`Model '${model}' rate limited across keys. Switching to next fallback model...`);
          break;
        }
      }
    }
  }

  throw lastError || new Error("All Groq API keys and fallback models failed.");
}

module.exports = {
  getNextClient,
  executeWithFailover,
};
