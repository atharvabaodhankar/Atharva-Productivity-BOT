const { getGoals } = require("../../services/memoryService");

module.exports = (bot) => {
  bot.command("goals", async (ctx) => {
    const chatId = ctx.chat.id;
    const userTimezone = ctx.state.user ? ctx.state.user.timezone : "Asia/Kolkata";
    const goals = await getGoals(chatId);

    if (goals.length === 0) {
      return ctx.reply("🎯 No goals set yet! Tell me 'Set a goal to...' to create one!");
    }

    let message = "🎯 Your Active Goals:\n\n";
    goals.forEach((g, i) => {
      message += `${i + 1}. ${g.content}\n`;
      if (g.date) {
        message += `   📅 Target: ${new Date(g.date).toLocaleDateString("en-US", { timeZone: userTimezone })}\n`;
      }
      message += `   ID: ${g._id}\n\n`;
    });

    ctx.reply(message);
  });
};
