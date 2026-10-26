const { getRecentReflections } = require("../../services/memoryService");
const { privateOnly } = require("../middlewares/privateOnly");

module.exports = (bot) => {
  bot.command("reflections", privateOnly(async (ctx) => {
    const chatId = ctx.chat.id;
    const userTimezone = ctx.state.user ? ctx.state.user.timezone : "Asia/Kolkata";

    try {
      const reflections = await getRecentReflections(chatId, 7);

      if (!reflections || reflections.length === 0) {
        return ctx.reply("📝 <b>No reflections logged in the last 7 days!</b>\n\nDuring our 10 PM check-in, share your wins, learnings, and thoughts to build your growth retrospective! ✨", { parse_mode: "HTML" });
      }

      let message = "📝 <b>Your 7-Day Retrospective Log:</b>\n";
      message += "━━━━━━━━━━━━━━━━━━━━━\n\n";

      reflections.forEach((r, i) => {
        const dateStr = new Date(r.createdAt).toLocaleDateString("en-US", {
          timeZone: userTimezone,
          weekday: "short",
          month: "short",
          day: "numeric",
        });
        message += `<b>${i + 1}.</b> <i>"${r.content}"</i>\n`;
        message += `   📅 <code>${dateStr}</code>\n\n`;
      });

      message += "🌱 <i>Consistent daily self-awareness is the secret to mastery.</i> 💡";

      ctx.reply(message, { parse_mode: "HTML" });
    } catch (err) {
      console.error("Reflections command error:", err);
      ctx.reply("Oops! Couldn't load reflections right now. Try again in a bit!");
    }
  }));
};
