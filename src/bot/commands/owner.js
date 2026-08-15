const { Markup } = require("telegraf");

module.exports = (bot) => {
  const handler = (ctx) => {
    const text =
      `🚀 *Meet the Creator of AtharvaOS!*\n\n` +
      `AtharvaOS was designed and built from scratch by *Atharva Baodhankar* — a passionate designer and full-stack software engineer! 💻✨\n\n` +
      `He continuously updates and refines my AI engine, mini app dashboard, and productivity systems to help people stay focused and build real momentum every single day.\n\n` +
      `🔗 *Connect with Atharva:*\n` +
      `📸 [Instagram](https://instagram.com/atharvabaodhankar/)\n` +
      `💼 [LinkedIn](https://linkedin.com/in/atharva-baodhankar/)\n` +
      `🐙 [GitHub](https://github.com/atharvabaodhankar)\n\n` +
      `_What do you think of his work on AtharvaOS so far? Let him know or ask me anything!_ 😊🔥`;

    ctx.reply(
      text,
      Markup.inlineKeyboard([
        [Markup.button.url("📸 Instagram", "https://instagram.com/atharvabaodhankar/")],
        [Markup.button.url("💼 LinkedIn", "https://linkedin.com/in/atharva-baodhankar/")],
        [Markup.button.url("🐙 GitHub", "https://github.com/atharvabaodhankar")],
      ])
    );
  };

  bot.command("owner", handler);
  bot.command("creator", handler);
  bot.command("developer", handler);
};
