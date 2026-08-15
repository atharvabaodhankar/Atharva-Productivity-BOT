const { getTodaySummary } = require("../../services/memoryService");

module.exports = (bot) => {
  bot.command("today", async (ctx) => {
    const chatId = ctx.chat.id;
    const name = ctx.state.user ? ctx.state.user.firstName : "champ";
    const userTimezone = ctx.state.user ? ctx.state.user.timezone : "Asia/Kolkata";

    const { todayDue, upcomingTasks } = await getTodaySummary(chatId);

    const now = new Date();
    const hour = parseInt(
      now.toLocaleTimeString("en-US", { timeZone: userTimezone, hour: "numeric", hour12: false }),
      10
    );

    let greeting = `🌅 Good Morning, ${name}`;
    if (hour >= 12 && hour < 17) greeting = `☀️ Good Afternoon, ${name}`;
    if (hour >= 17 && hour < 21) greeting = `🌆 Good Evening, ${name}`;
    if (hour >= 21 || hour < 5) greeting = `🌙 Still Awake, ${name}`;

    let message = `${greeting}! Here's your mission report:\n\n`;

    if (todayDue.length > 0) {
      message += "🔥 DUE TODAY (Priority mode ON!):\n";
      todayDue.forEach((item) => {
        message += `• ${item.content}\n`;
      });
      message += "\n";
    }

    if (upcomingTasks.length > 0) {
      message += "📋 Coming Up Next:\n";
      upcomingTasks.forEach((item) => {
        message += `• ${item.content}`;
        if (item.date) {
          message += ` (${new Date(item.date).toLocaleDateString("en-US", { timeZone: userTimezone })})`;
        }
        message += "\n";
      });
    }

    if (todayDue.length === 0 && upcomingTasks.length === 0) {
      message += "✨ All clear! No pending tasks!\n\nTime to set new goals or just chill! 😎🎮";
    } else if (todayDue.length > 0) {
      message += "\n💪 Chal bhai, let's knock these out! You got this! 🚀";
    } else {
      message += "\n🎯 Looking solid! Stay ahead of the game! 💯";
    }

    ctx.reply(message);
  });
};
