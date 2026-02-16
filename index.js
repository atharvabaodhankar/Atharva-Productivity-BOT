require('dotenv').config();
const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => {
  ctx.reply('Welcome to LifeOS 🚀\nYour personal productivity assistant.');
});

bot.help((ctx) => {
  ctx.reply('Send me anything. I will remember it soon 😎');
});

bot.on('text', (ctx) => {
  ctx.reply(`Saved (temporary): ${ctx.message.text}`);
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));