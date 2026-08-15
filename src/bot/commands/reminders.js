const { getReminders } = require("../../services/memoryService");
const { privateOnly } = require("../middlewares/privateOnly");

module.exports = (bot) => {
  bot.command("reminders", privateOnly(async (ctx) => {
    const chatId = ctx.chat.id;
    const userTimezone = ctx.state.user ? ctx.state.user.timezone : "Asia/Kolkata";
    const reminders = await getReminders(chatId);

    if (reminders.length === 0) {
      return ctx.reply("🔔 No active reminders! Tell me 'Remind me to...' anytime!");
    }

    let message = "🔔 Your Active Reminders:\n\n";
    reminders.forEach((r, i) => {
      message += `${i + 1}. ${r.content}\n`;
      if (r.date) {
        message += `   ⏰ ${new Date(r.date).toLocaleString("en-US", { timeZone: userTimezone })}\n`;
      }
      message += `   ID: ${r._id}\n\n`;
    });

    ctx.reply(message);
  }));
};
