const { getReminders } = require("../../services/memoryService");
const { privateOnly } = require("../middlewares/privateOnly");

module.exports = (bot) => {
  bot.command("reminders", privateOnly(async (ctx) => {
    const chatId = ctx.chat.id;
    const userTimezone = ctx.state.user ? ctx.state.user.timezone : "Asia/Kolkata";
    const reminders = await getReminders(chatId);

    if (reminders.length === 0) {
      return ctx.reply("🔔 No active reminders! Tell me 'Remind me daily at 8 PM to...' or 'Remind me in 30 mins' anytime!");
    }

    let message = "🔔 <b>Your Active Reminders:</b>\n\n";
    reminders.forEach((r, i) => {
      const recurTag = r.isRecurring ? ` <i>[🔁 ${r.recurrenceInterval || "Daily"}]</i>` : "";
      message += `${i + 1}. <b>${r.content}</b>${recurTag}\n`;
      if (r.date) {
        message += `   ⏰ Next: ${new Date(r.date).toLocaleString("en-US", { timeZone: userTimezone, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}\n`;
      }
      message += `   <code>/delete ${r._id}</code>\n\n`;
    });

    ctx.reply(message, { parse_mode: "HTML" });
  }));
};
