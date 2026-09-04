const { getReminders } = require("../../services/memoryService");
const { privateOnly } = require("../middlewares/privateOnly");
const Memory = require("../../models/Memory");

function buildRemindersView(reminders, userTimezone) {
  let message = "🔔 <b>Your Active Reminders:</b>\n\n";
  const inlineKeyboard = [];

  reminders.forEach((r, i) => {
    const recurTag = r.isRecurring ? ` <i>[🔁 ${r.recurrenceInterval || "Daily"}]</i>` : "";
    message += `${i + 1}. <b>${r.content}</b>${recurTag}\n`;
    if (r.date) {
      message += `   ⏰ Next: ${new Date(r.date).toLocaleString("en-US", {
        timeZone: userTimezone,
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })}\n`;
    }
    message += "\n";

    const titleSnippet = r.content.length > 20 ? `${r.content.substring(0, 20)}…` : r.content;
    inlineKeyboard.push([
      {
        text: `🗑️ Delete #${i + 1}: ${titleSnippet}`,
        callback_data: `del_rem_${r._id}`,
      },
    ]);
  });

  if (reminders.length > 1) {
    inlineKeyboard.push([
      {
        text: "🗑️ Delete All Reminders",
        callback_data: "del_rem_all",
      },
    ]);
  }

  return { message, reply_markup: { inline_keyboard: inlineKeyboard } };
}

module.exports = (bot) => {
  bot.command(["reminders", "reminder"], privateOnly(async (ctx) => {
    const chatId = ctx.chat.id;
    const userTimezone = ctx.state.user ? ctx.state.user.timezone : "Asia/Kolkata";
    const reminders = await getReminders(chatId);

    if (reminders.length === 0) {
      return ctx.reply(
        "🔔 No active reminders! Tell me 'Remind me daily at 8 PM to...' or 'Remind me in 30 mins' anytime!"
      );
    }

    const { message, reply_markup } = buildRemindersView(reminders, userTimezone);
    ctx.reply(message, { parse_mode: "HTML", reply_markup });
  }));

  // Handle individual reminder deletion button
  bot.action(/^del_rem_(.+)$/, async (ctx) => {
    try {
      const reminderId = ctx.match[1];
      const chatId = ctx.chat?.id || ctx.from?.id;
      const userTimezone = ctx.state?.user ? ctx.state.user.timezone : "Asia/Kolkata";

      const deleted = await Memory.findOneAndDelete({ _id: reminderId, chatId });
      if (deleted) {
        await ctx.answerCbQuery(`🗑️ Deleted: "${deleted.content}"`);
      } else {
        await ctx.answerCbQuery("Reminder already deleted.");
      }

      const reminders = await getReminders(chatId);
      if (reminders.length === 0) {
        try {
          await ctx.editMessageText(
            "🔔 <b>All reminders cleared!</b>\n\nYou have no active reminders right now. ✨",
            { parse_mode: "HTML" }
          );
        } catch (e) {
          await ctx.reply("🔔 All reminders cleared! ✨");
        }
      } else {
        const { message, reply_markup } = buildRemindersView(reminders, userTimezone);
        try {
          await ctx.editMessageText(message, { parse_mode: "HTML", reply_markup });
        } catch (e) {
          // Ignore unmodified message error if rapid clicking
        }
      }
    } catch (err) {
      console.error("del_rem action error:", err);
      try {
        await ctx.answerCbQuery("Error deleting reminder");
      } catch (e) {}
    }
  });

  // Handle delete all reminders button
  bot.action("del_rem_all", async (ctx) => {
    try {
      const chatId = ctx.chat?.id || ctx.from?.id;
      const res = await Memory.deleteMany({ chatId, type: "reminder" });
      await ctx.answerCbQuery(`🗑️ Deleted all ${res.deletedCount} reminders!`);

      try {
        await ctx.editMessageText(
          "🔔 <b>All reminders cleared!</b>\n\nYou have no active reminders right now. ✨",
          { parse_mode: "HTML" }
        );
      } catch (e) {
        await ctx.reply("🔔 All reminders cleared! ✨");
      }
    } catch (err) {
      console.error("del_rem_all action error:", err);
      try {
        await ctx.answerCbQuery("Error clearing reminders");
      } catch (e) {}
    }
  });
};
