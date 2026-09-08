require("dotenv").config();

function getEnv(key, defaultValue = "") {
  return process.env[key] || defaultValue;
}

function getGroqKeys() {
  const envKeyString = getEnv("GROQ_API_KEY");
  const keys = envKeyString
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  if (keys.length === 0) {
    console.warn("⚠️ Warning: No GROQ_API_KEY provided in environment variables!");
  }
  return keys;
}

module.exports = {
  NODE_ENV: getEnv("NODE_ENV", "development"),
  PORT: process.env.PORT || 3000,
  BOT_TOKEN: getEnv("BOT_TOKEN"),
  MONGO_URI: getEnv("MONGO_URI"),
  CHAT_ID: getEnv("CHAT_ID"),
  WEBHOOK_DOMAIN: getEnv("WEBHOOK_DOMAIN"),
  GROQ_API_KEYS: getGroqKeys(),
  MEME_API_URL: getEnv("MEME_API_URL"),
  MEME_API_KEY: getEnv("MEME_API_KEY"),
  ADMIN_SECRET: getEnv("ADMIN_SECRET"),
  AWS_REGION: getEnv("BEDROCK_AWS_REGION") || getEnv("AWS_REGION", "ap-south-1"),
  AWS_ACCESS_KEY_ID: getEnv("BEDROCK_AWS_ACCESS_KEY_ID") || getEnv("AWS_ACCESS_KEY_ID"),
  AWS_SECRET_ACCESS_KEY: getEnv("BEDROCK_AWS_SECRET_ACCESS_KEY") || getEnv("AWS_SECRET_ACCESS_KEY"),
  BEDROCK_LLM_MODEL_ID: getEnv("BEDROCK_LLM_MODEL_ID", "apac.amazon.nova-micro-v1:0"),
  BEDROCK_EMBEDDING_MODEL_ID: getEnv("BEDROCK_EMBEDDING_MODEL_ID", "amazon.titan-embed-text-v2:0"),
};
