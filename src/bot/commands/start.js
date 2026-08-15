const { Markup } = require("telegraf");

module.exports = (bot) => {
  bot.start((ctx) => {
    const user = ctx.state.user;
    const username = (user?.username || ctx.from?.username || "").toLowerCase().replace(/^@/, "");
    const name = user ? user.firstName : (ctx.from?.first_name || "Champ");
    const webappUrl = process.env.WEBAPP_URL;

    // Secure Custom Persona for @eshhh_02 ONLY
    if (username === "eshhh_02") {
      const specialGreeting = `Hi Ashu ❤️ This is a bot by your husband Athi, he modified me just for you to talk like this! ✨\n\nReady to organize your day and crush some goals? I'm right here for you, Ashu! 🌸`;
      
      if (webappUrl) {
        return ctx.reply(
          specialGreeting,
          Markup.inlineKeyboard([
            [Markup.button.webApp("🚀 Open Web Dashboard", webappUrl)],
          ])
        );
      }
      return ctx.reply(specialGreeting);
    }

    // Default Greetings for all other users
    const funGreetings = [
      `Yo yo yo ${name}! AtharvaOS is LIVE! 🚀\nReady to crush some goals today? Let's goooo! 💪`,
      `Arre ${name} bhai! Your personal productivity copilot is here! 🔥\nBata kya karna hai aaj? Let's make it happen! 💯`,
      `LESSGOOO ${name}! 🎯 AtharvaOS activated!\nTime to turn those dreams into reality! ⚡`,
      `Ayeee ${name}! What's good? 😎\nYour second brain is online and ready to help you dominate! 🏆`,
    ];

    const greeting = funGreetings[Math.floor(Math.random() * funGreetings.length)];

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
