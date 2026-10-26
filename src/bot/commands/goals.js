const { getGoals } = require("../../services/memoryService");
const { privateOnly } = require("../middlewares/privateOnly");

module.exports = (bot) => {
  bot.command("goals", privateOnly(async (ctx) => {
    const chatId = ctx.chat.id;
    const userTimezone = ctx.state.user ? ctx.state.user.timezone : "Asia/Kolkata";
    const goals = await getGoals(chatId);

    if (goals.length === 0) {
      return ctx.reply("🎯 <b>No goals set yet!</b>\n\nTell me <i>'Set a goal to read 20 pages daily'</i> or <i>'My goal is to learn Rust'</i> to create one!", { parse_mode: "HTML" });
    }

    let message = "🎯 <b>Your Active Goals:</b>\n";
    message += "━━━━━━━━━━━━━━━━━━━━━\n\n";

    goals.forEach((g, i) => {
      message += `<b>${i + 1}. ${g.content}</b>\n`;
      if (g.date) {
        message += `   📅 <i>Target Date: ${new Date(g.date).toLocaleDateString("en-US", { timeZone: userTimezone })}</i>\n`;
      }
      message += "\n";
    });

    message += "🔥 <i>Dream big, stay relentless, and make it happen!</i> 💪";

    ctx.reply(message, { parse_mode: "HTML" });
  }));
};
