const { getTodaySummary } = require("../../services/memoryService");
const { privateOnly } = require("../middlewares/privateOnly");

module.exports = (bot) => {
  bot.command("today", privateOnly(async (ctx) => {
    const chatId = ctx.chat.id;
    const name = ctx.state.user ? ctx.state.user.firstName : "champ";
    const userTimezone = ctx.state.user ? ctx.state.user.timezone : "Asia/Kolkata";

    const { todayDue, todayReminders, upcomingTasks } = await getTodaySummary(chatId, userTimezone);

    const now = new Date();
    const hour = parseInt(
      now.toLocaleTimeString("en-US", { timeZone: userTimezone, hour: "numeric", hour12: false }),
      10
    );

    let greeting = `🌅 <b>Good Morning, ${name}</b>`;
    if (hour >= 12 && hour < 17) greeting = `☀️ <b>Good Afternoon, ${name}</b>`;
    if (hour >= 17 && hour < 21) greeting = `🌆 <b>Good Evening, ${name}</b>`;
    if (hour >= 21 || hour < 5) greeting = `🌙 <b>Late Night Hustle, ${name}</b>`;

    let message = `${greeting}!\n`;
    message += "━━━━━━━━━━━━━━━━━━━━━\n\n";

    const inlineKeyboard = [];

    // Section 1: Due Today
    if (todayDue.length > 0) {
      message += "🔥 <b>DUE TODAY (High Priority):</b>\n";
      todayDue.forEach((item, i) => {
        const projStr = item.projectName ? ` 📁 <i>[${item.projectName}]</i>` : "";
        message += `• <b>${item.content}</b>${projStr}\n`;

        if (i < 3) {
          const snippet = item.content.length > 20 ? `${item.content.substring(0, 20)}…` : item.content;
          inlineKeyboard.push([
            {
              text: `✅ Done: ${snippet}`,
              callback_data: `done_task_${item._id}`,
            },
          ]);
        }
      });
      message += "\n";
    }

    // Section 2: Today's Reminders
    if (todayReminders && todayReminders.length > 0) {
      message += "⏰ <b>TODAY'S REMINDERS & ROUTINES:</b>\n";
      todayReminders.forEach((r) => {
        const recurTag = r.isRecurring ? ` <i>[🔁 ${r.recurrenceInterval || "Daily"}]</i>` : "";
        let timeStr = "";
        if (r.date) {
          timeStr = ` at ${new Date(r.date).toLocaleTimeString("en-US", {
            timeZone: userTimezone,
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })}`;
        }
        message += `• 🔔 <b>${r.content}</b>${timeStr}${recurTag}\n`;
      });
      message += "\n";
    }

    // Section 3: Coming Up Next
    if (upcomingTasks.length > 0) {
      message += "📋 <b>COMING UP NEXT:</b>\n";
      upcomingTasks.forEach((item) => {
        let dateStr = "";
        if (item.date) {
          dateStr = ` (${new Date(item.date).toLocaleDateString("en-US", {
            timeZone: userTimezone,
            month: "short",
            day: "numeric",
          })})`;
        }
        message += `• ${item.content}${dateStr}\n`;
      });
      message += "\n";
    }

    if (todayDue.length === 0 && (!todayReminders || todayReminders.length === 0) && upcomingTasks.length === 0) {
      message += "✨ <b>All clear! No pending tasks for today!</b>\n\nTime to set new goals or just chill! 😎🎮";
    } else if (todayDue.length > 0) {
      message += "💪 <i>Chal bhai, let's knock these out! You got this!</i> 🚀";
    } else {
      message += "🎯 <i>Looking solid! Stay ahead of the game, champ!</i> 💯";
    }

    ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: inlineKeyboard.length > 0 ? { inline_keyboard: inlineKeyboard } : undefined,
    });
  }));
};
