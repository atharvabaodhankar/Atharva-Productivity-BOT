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

    let message = "📋 <b>Your Pending Tasks:</b>\n";
    message += "━━━━━━━━━━━━━━━━━━━━━\n\n";

    const inlineKeyboard = [];

    tasks.forEach((t, i) => {
      const priorityEmoji = t.priority === "high" ? "🔥" : t.priority === "low" ? "🟢" : "⚡";
      const priorityLabel = (t.priority || "medium").toUpperCase();
      const projTag = t.projectName ? ` 📁 <i>[${t.projectName}]</i>` : "";

      message += `<b>${i + 1}. ${t.content}</b>${projTag}\n`;
      message += `   ${priorityEmoji} <i>Priority: ${priorityLabel}</i>`;

      if (t.date) {
        const dueDate = new Date(t.date);
        const daysLeft = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));
        const formattedDate = dueDate.toLocaleDateString("en-US", {
          timeZone: userTimezone,
          month: "short",
          day: "numeric",
        });

        message += ` | 📅 ${formattedDate}`;
        if (daysLeft < 0) {
          message += ` ⚠️ <b>OVERDUE!</b>`;
        } else if (daysLeft === 0) {
          message += ` 🔥 <b>DUE TODAY!</b>`;
        } else if (daysLeft <= 2) {
          message += ` ⏰ <i>${daysLeft}d left</i>`;
        }
      }

      if (t.tags && t.tags.length > 0) {
        message += `\n   🏷️ ${t.tags.map((tag) => `#${tag}`).join(" ")}`;
      }

      message += "\n\n";

      // Add inline quick-complete button for top 4 tasks
      if (i < 4) {
        const snippet = t.content.length > 18 ? `${t.content.substring(0, 18)}…` : t.content;
        inlineKeyboard.push([
          {
            text: `✅ Complete #${i + 1}: ${snippet}`,
            callback_data: `done_task_${t._id}`,
          },
        ]);
      }
    });

    if (tasks.length > 3) {
      message += "💪 <i>That's solid focus! One task at a time, you got this!</i> 🔥";
    } else {
      message += "🎯 <i>Looking good! Finish these and you're golden!</i> ✨";
    }

    message += "\n\n💡 <b>Tip:</b> <i>Type <code>/done 1</code> or tap a button below to mark complete!</i>";

    ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: inlineKeyboard.length > 0 ? { inline_keyboard: inlineKeyboard } : undefined,
    });
  }));
};
