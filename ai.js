require("dotenv").config();
const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function askAI(message) {
  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: "You are AtharvaOS, a personal productivity and second brain assistant.",
      },
      {
        role: "user",
        content: message,
      },
    ],
    model: "llama-3.3-70b-versatile",
    temperature: 0.7,
    max_completion_tokens: 1024,
  });

  return completion.choices[0].message.content;
}

module.exports = { askAI };