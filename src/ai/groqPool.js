const Groq = require("groq-sdk");
const { GROQ_API_KEYS } = require("../config/env");

let currentKeyIndex = 0;

function getNextClient() {
  if (!GROQ_API_KEYS || GROQ_API_KEYS.length === 0) {
    throw new Error("No Groq API keys configured. Set GROQ_API_KEY environment variable.");
  }

  const key = GROQ_API_KEYS[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % GROQ_API_KEYS.length;
  return new Groq({ apiKey: key });
}

async function executeWithFailover(createParams) {
  const totalKeys = Math.max(1, GROQ_API_KEYS.length);
  let lastError = null;

  for (let attempt = 0; attempt < totalKeys; attempt++) {
    try {
      const client = getNextClient();
      return await client.chat.completions.create(createParams);
    } catch (err) {
      console.warn(
        `Groq request failed on key attempt ${attempt + 1}/${totalKeys}: ${err.message}. Rotating...`
      );
      lastError = err;
    }
  }

  throw lastError || new Error("All Groq API keys in the pool failed.");
}

module.exports = {
  getNextClient,
  executeWithFailover,
};
