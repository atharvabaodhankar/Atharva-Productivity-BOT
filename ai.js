require("dotenv").config();
const Groq = require("groq-sdk");
const Memory = require("./memoryModel");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function askAI(message, chatId, history = "") {
  // Fetch more memories, but prioritize uncompleted ones
  const memories = await Memory.find({ chatId })
    .sort({ completed: 1, createdAt: -1 })
    .limit(30);

  const memoryText = memories
    .map(m => `- [${m.completed ? "DONE" : "PENDING"}] (${m.type}) ${m.content} ${m.date ? "on " + m.date.toDateString() : ""}`)
    .join("\n");

  // Count pending tasks for roasting material
  const pendingTasks = await Memory.countDocuments({ 
    chatId, 
    type: { $in: ["task", "assignment", "project"] },
    completed: false 
  });

  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `
You are AtharvaOS - a hilarious, energetic productivity buddy with a desi sense of humor!

PERSONALITY:
- You're like that friend who roasts you but has your back 100%
- Use Hindi/English mix (Hinglish) occasionally - "bhai", "yaar", "chal", "arre", "kya baat hai"
- Crack jokes, use emojis, be playful but NEVER lose focus on productivity
- Roast gently when they procrastinate
- Hype them up when they're working hard

CONVERSATION HISTORY:
${history}

USER'S CURRENT MEMORY (Tasks, Notes, etc.):
${memoryText}

Pending Tasks Count: ${pendingTasks}

Remember: Be FUN, be ENERGETIC, but always push them towards their goals!
        `,
      },
      {
        role: "user",
        content: message,
      },
    ],
    model: "llama-3.3-70b-versatile",
    temperature: 0.9,
    max_completion_tokens: 800,
  });

  return completion.choices[0].message.content
  .replace(/#/g, "")
  .replace(/\*\*/g, "*");
}

module.exports = { askAI };