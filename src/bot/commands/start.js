const { Markup } = require("telegraf");

module.exports = (bot) => {
  bot.start((ctx) => {
    const name = ctx.state.user ? ctx.state.user.firstName : "Champ";

    const funGreetings = [
      `Yo yo yo ${name}! AtharvaOS is LIVE! 🚀\nReady to crush some goals today? Let's goooo! 💪`,
      `Arre ${name} bhai! Your personal productivity copilot is here! 🔥\nBata kya karna hai aaj? Let's make it happen! 💯`,
      `LESSGOOO ${name}! 🎯 AtharvaOS activated!\nTime to turn those dreams into reality! ⚡`,
      `Ayeee ${name}! What's good? 😎\nYour second brain is online and ready to help you dominate! 🏆`,
    ];

    const greeting = funGreetings[Math.floor(Math.random() * funGreetings.length)];
    const webappUrl = process.env.WEBAPP_URL;

    if (webappUrl) {
      return ctx.reply(
        greeting,
        Markup.inlineKeyboard([
          [Markup.button.webApp("🚀 Open Web Dashboard", webappUrl)],
        ])
      );
    }

    ctx.reply(greeting);
  });
};
