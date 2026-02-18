require("dotenv").config();
const { Telegraf } = require("telegraf");
const { askAI } = require("./ai");
const mongoose = require("mongoose");

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));
  

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => {
  ctx.reply("AtharvaOS Activated.\nYour Second Brain is Online.");
});

bot.on("text", async (ctx) => {
  try {
    const userMessage = ctx.message.text;

    ctx.reply("Thinking...");

    const aiReply = await askAI(userMessage);

    ctx.reply(aiReply);
  } catch (error) {
    console.error(error);
    ctx.reply("AI error occurred.");
  }
});

bot.launch();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));