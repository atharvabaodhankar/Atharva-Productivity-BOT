require("dotenv").config();
const readline = require("readline");
const mongoose = require("mongoose");
const { askAI } = require("./ai");
const History = require("./historyModel");

// Use a fixed terminal chat ID (separate from Telegram)
const CHAT_ID = "terminal-chat";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt() {
  rl.question("You: ", async (input) => {
    const message = input.trim();
    if (!message) return prompt();

    if (message.toLowerCase() === "exit" || message.toLowerCase() === "quit") {
      console.log("Bot: Later bhai! 👋");
      await mongoose.disconnect();
      rl.close();
      return;
    }

    try {
      // Fetch recent history
      const history = await History.find({ chatId: CHAT_ID })
        .sort({ createdAt: -1 })
        .limit(5);
      const historyContext = history
        .reverse()
        .map((h) => `${h.role}: ${h.content}`)
        .join("\n");

      const reply = await askAI(message, CHAT_ID, historyContext);

      // Save to history
      await History.create([
        { chatId: CHAT_ID, role: "user", content: message },
        { chatId: CHAT_ID, role: "assistant", content: reply },
      ]);

      console.log(`\nBot: ${reply}\n`);
    } catch (err) {
      console.error("Error:", err.message);
    }

    prompt();
  });
}

async function main() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected!\n");
  console.log("AtharvaOS Terminal Chat 🚀 (type 'exit' to quit)\n");
  prompt();
}

main().catch((err) => {
  console.error("Failed to start:", err.message);
  process.exit(1);
});
