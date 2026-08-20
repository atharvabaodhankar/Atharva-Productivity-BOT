const Groq = require("groq-sdk");
const { GROQ_API_KEYS } = require("../config/env");

let currentKeyIndex = 0;

const TEXT_MODELS = [
  "qwen/qwen3.6-27b",
  "qwen-2.5-32b",
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "deepseek-r1-distill-llama-70b",
  "llama3-70b-8192",
  "llama3-8b-8192",
];

const VISION_MODELS = [
  "llama-3.2-11b-vision-preview",
  "llama-3.2-90b-vision-preview",
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
  // Detect if prompt contains image content
  const hasImage = createParams.messages?.some(
    (m) =>
      Array.isArray(m.content) &&
      m.content.some((c) => c.type === "image_url")
  );

  const fallbackList = hasImage ? VISION_MODELS : TEXT_MODELS;
  const primaryModel =
    createParams.model ||
    (hasImage ? "llama-3.2-11b-vision-preview" : "qwen/qwen3.6-27b");

  // Build model fallback sequence
  const modelsToTry = [
    primaryModel,
    ...fallbackList.filter((m) => m !== primaryModel),
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
          (err.message &&
            (err.message.includes("429") ||
              err.message.includes("rate_limit") ||
              err.message.includes("tokens per day")));

        const isModelError =
          err.status === 400 ||
          err.status === 404 ||
          (err.message &&
            (err.message.includes("model_not_found") ||
              err.message.includes("model_decommissioned") ||
              err.message.includes("does not exist") ||
              err.message.includes("not supported") ||
              err.message.includes("Image URL is only supported")));

        console.warn(
          `Groq request failed on model '${model}' (key attempt ${attempt + 1}/${totalKeys}): ${err.message}. ${
            isRateLimit
              ? "Rate limit detected. Rotating model/key..."
              : isModelError
              ? "Model error. Switching model immediately..."
              : "Rotating..."
          }`
        );

        // If the model is decommissioned, invalid, or doesn't support the input type, skip to next model immediately
        if (isModelError) {
          break;
        }

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
