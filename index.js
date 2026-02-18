require("dotenv").config();
const { Telegraf } = require("telegraf");
const mongoose = require("mongoose");

const { askAI } = require("./ai");
const { classifyMemory } = require("./memoryAI");
const Memory = require("./memoryModel");

const bot = new Telegraf(process.env.BOT_TOKEN);

// MongoDB connect
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

// Start command
bot.start((ctx) => {
  ctx.reply("AtharvaOS Activated.\nYour Second Brain is Online.");
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

    ctx.reply(reply);

  } catch (error) {
    console.error(error);
    ctx.reply("Something went wrong.");
  }
});

bot.launch();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));