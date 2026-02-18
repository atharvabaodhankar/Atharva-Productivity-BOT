require("dotenv").config();
const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function classifyMemory(message) {
  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `
You are an AI that extracts important memories for a productivity assistant.

Return ONLY valid JSON.

Fields:
store (true/false)
type (task, assignment, exam, project, goal, idea, reminder, note)
content
date (optional ISO format)

If not important, set store false.
        `,
      },
      {
        role: "user",
        content: message,
      },
    ],
    model: "llama-3.1-8b-instant",
    temperature: 0,
    response_format: { type: "json_object" },
  });

  return JSON.parse(completion.choices[0].message.content);
}

module.exports = { classifyMemory };