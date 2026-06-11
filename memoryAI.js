require("dotenv").config();
const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function classifyMemory(message, history = "") {
  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `
You are an AI that extracts important memories (like new tasks, assignments, exams, projects, goals, ideas, reminders, notes, and reflections) to store in the database.

CRITICAL: Do NOT store messages that are queries, commands, or requests to list/show/delete/clear information (e.g., "show tasks", "what are my tasks", "list reminders", "clear all", "delete everything"). For these, set store to false.

Use the conversation history if provided to understand context (e.g., if the user says "and this too", look at what "this" refers to).

Return ONLY valid JSON.

Fields:
store (true/false)
type (task, assignment, exam, project, goal, idea, reminder, note, reflection)
content
date (optional ISO format)

If not important or if it is a query/command, set store false.

CONVERSATION HISTORY:
${history}
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