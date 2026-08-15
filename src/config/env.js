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
  MEME_API_URL: getEnv("MEME_API_URL", "https://redditreels.onrender.com"),
  MEME_API_KEY: getEnv("MEME_API_KEY", "rr_live_9f8d7a6b5c4e3d2a1f0e8d7c6b5a4f3e"),
};
