const { getPendingTasks } = require("../../services/memoryService");
const { privateOnly } = require("../middlewares/privateOnly");

module.exports = (bot) => {
  bot.command("tasks", privateOnly(async (ctx) => {
    const chatId = ctx.chat.id;
    const userTimezone = ctx.state.user ? ctx.state.user.timezone : "Asia/Kolkata";
    const tasks = await getPendingTasks(chatId);

    if (tasks.length === 0) {
      const funMessages = [
        "Woohoo! 🎉 No pending tasks! You're a productivity BEAST! Time to chill or set new goals? 😎",
        "Arre wah! All clear! 🌟 Kya baat hai! Now go enjoy or plan something epic! 🚀",
        "YOOO! Task list = EMPTY! 💯 You're crushing it! Time for some well-deserved fun! 🎮",
      ];
      return ctx.reply(funMessages[Math.floor(Math.random() * funMessages.length)]);
    }

    let message = "📌 Alright boss, here's what's pending:\n\n";
    tasks.forEach((t, i) => {
      const priorityEmoji = t.priority === "high" ? "🔥 " : t.priority === "low" ? "🟢 " : "⚡ ";
      message += `${i + 1}. ${priorityEmoji}${t.content}\n`;

      if (t.date) {
        const dueDate = new Date(t.date);
        const daysLeft = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));
        const formattedDate = dueDate.toLocaleDateString("en-US", { timeZone: userTimezone });

        message += `   📅 ${formattedDate}`;
        if (daysLeft < 0) {
          message += ` ⚠️ OVERDUE! Bhai kya kar raha hai? 😅`;
        } else if (daysLeft === 0) {
          message += ` 🔥 DUE TODAY! Let's gooo!`;
        } else if (daysLeft <= 2) {
          message += ` ⏰ ${daysLeft} days left! Hurry up!`;
        }
        message += "\n";
      }

      if (t.tags && t.tags.length > 0) {
        message += `   🏷️ ${t.tags.map((tag) => `#${tag}`).join(" ")}\n`;
      }
      message += `   ID: ${t._id}\n\n`;
    });

    if (tasks.length > 3) {
      message += "💪 That's a lot! But you got this, champ! One task at a time! 🔥";
    } else {
      message += "🎯 Looking good! Finish these and you're golden! ✨";
    }

    ctx.reply(message);
  }));
};
