require("dotenv").config();
const Groq = require("groq-sdk");
const Memory = require("./memoryModel");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function askAI(message) {
  // Fetch recent memories for context
  const memories = await Memory.find().sort({ createdAt: -1 }).limit(5);

  const memoryText = memories
    .map(m => `- (${m.type}) ${m.content} ${m.date ? "on " + m.date.toDateString() : ""}`)
    .join("\n");

  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `
You are AtharvaOS.

You are the future, disciplined version of Atharva.

Goals:
- Keep him productive
- Encourage studying
- Push him to finish tasks
- Give actionable steps

User Memory:
${memoryText}
        `,
      },
      {
        role: "user",
        content: message,
      },
    ],
    model: "llama-3.3-70b-versatile",
    temperature: 0.7,
    max_completion_tokens: 800,
  });

  return completion.choices[0].message.content
  .replace(/#/g, "")
  .replace(/\*\*/g, "*");
}

module.exports = { askAI };