const { getRecentReflections } = require("../../services/memoryService");

module.exports = (bot) => {
  bot.command("reflections", async (ctx) => {
    const chatId = ctx.chat.id;
    const userTimezone = ctx.state.user ? ctx.state.user.timezone : "Asia/Kolkata";
    const reflections = await getRecentReflections(chatId, 7);

    if (reflections.length === 0) {
      return ctx.reply(
        "📒 No reflections yet! Tell me what you achieved or learned today to log a reflection!"
      );
    }

    let message = "📒 Your Recent Growth Log (Last 7 Days):\n\n";
    reflections.forEach((r) => {
      message += `📅 ${new Date(r.createdAt).toLocaleDateString("en-US", { timeZone: userTimezone })}\n`;
      message += `✨ ${r.content}\n\n`;
    });

    message += "Keep making moves, champion! 🚀";
    ctx.reply(message);
  });
};
