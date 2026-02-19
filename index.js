require("dotenv").config();
const { Telegraf } = require("telegraf");
const mongoose = require("mongoose");
const { getTasks } = require("./taskService");
const { askAI } = require("./ai");
const { classifyMemory } = require("./memoryAI");
const Memory = require("./memoryModel");
const { startReminderService } = require("./reminderService");

const bot = new Telegraf(process.env.BOT_TOKEN);

// MongoDB connect
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

// Start command
bot.start((ctx) => {
  ctx.reply("AtharvaOS Activated.\nYour Second Brain is Online.");
});

bot.hears(/what are my tasks/i, async (ctx) => {
  const tasks = await getTasks();

  if (tasks.length === 0) {
    return ctx.reply("No tasks stored yet.");
  }

  let message = "📌 *Your Current Tasks*\n\n";

  tasks.forEach((t, i) => {
    message += `${i + 1}. *${t.content}*\n`;
    if (t.date) {
      message += `   ⏰ ${new Date(t.date).toDateString()}\n`;
    }
    message += "\n";
  });

  ctx.replyWithMarkdown(message);
});

// Main message handler
bot.on("text", async (ctx) => {
  try {
    const userMessage = ctx.message.text;

    // 1. Classify memory
    const classification = await classifyMemory(userMessage);

    if (classification.store) {
      await Memory.create({
        type: classification.type,
        content: classification.content,
        date: classification.date || null,
      });
    }

    // 2. AI reply with memory context
    const reply = await askAI(userMessage);

    ctx.replyWithMarkdown(reply);
  } catch (error) {
    console.error(error);
    ctx.reply("Something went wrong.");
  }
});

bot.launch();
startReminderService(bot);

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
