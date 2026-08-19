// Proxy legacy ai.js directly to modular src/ai/aiService.js
const { askAI } = require("./src/ai/aiService");

module.exports = { askAI };