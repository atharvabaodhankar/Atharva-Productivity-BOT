const { getReminders } = require("../../services/memoryService");
const { privateOnly } = require("../middlewares/privateOnly");
const Memory = require("../../models/Memory");
const User = require("../../models/User");

function buildRemindersView(reminders, user, userTimezone) {
  const prefs = user?.preferences || {};
  const isMorningOn = prefs.morningSummaryEnabled !== false && prefs.dailyRemindersEnabled !== false;
  const isNightOn = prefs.nightlyReflectionEnabled !== false && prefs.dailyRemindersEnabled !== false;
  const isMasterOn = prefs.dailyRemindersEnabled !== false;

  let message = "🔔 <b>Reminders & Daily Schedules Hub</b>\n";
  message += "━━━━━━━━━━━━━━━━━━━━━\n\n";

  // Section 1: Automated Daily Routines
  message += "⚙️ <b>Automated Daily Messages:</b>\n";
  message += `• 🌅 <b>Morning Briefing (8 AM):</b> ${isMorningOn ? "✅ <b>Active</b>" : "❌ <i>Disabled</i>"}\n`;
  message += `• 🌙 <b>Nightly Check-In (10 PM):</b> ${isNightOn ? "✅ <b>Active</b>" : "❌ <i>Disabled</i>"}\n`;
  message += `• 🔕 <b>Master Notifications:</b> ${isMasterOn ? "✅ <b>Enabled</b>" : "❌ <i>All Muted</i>"}\n\n`;

  // Section 2: Custom Reminders
  if (reminders.length === 0) {
    message += "📌 <i>No custom reminders active. Tell me 'Remind me daily at 8 PM to...' or 'Remind me in 30 mins' to add one!</i>\n";
  } else {
    message += `📋 <b>Your Custom Reminders (${reminders.length}):</b>\n`;
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
    });
  }

  const inlineKeyboard = [
    [
      {
        text: isMorningOn ? "🌅 Turn OFF Morning (8 AM)" : "🌅 Turn ON Morning (8 AM)",
        callback_data: "toggle_morning_summary",
      },
    ],
    [
      {
        text: isNightOn ? "🌙 Turn OFF Night (10 PM)" : "🌙 Turn ON Night (10 PM)",
        callback_data: "toggle_night_reflection",
      },
    ],
    [
      {
        text: isMasterOn ? "🔕 Mute All Daily Messages" : "🔔 Unmute All Daily Messages",
        callback_data: "toggle_master_reminders",
      },
    ],
  ];

  if (reminders.length > 0) {
    reminders.forEach((r, i) => {
      const titleSnippet = r.content.length > 18 ? `${r.content.substring(0, 18)}…` : r.content;
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
          text: "🗑️ Delete All Custom Reminders",
          callback_data: "del_rem_all",
        },
      ]);
    }
  }

  return { message, reply_markup: { inline_keyboard: inlineKeyboard } };
}

module.exports = (bot) => {
  bot.command(["reminders", "reminder", "daily", "briefings"], privateOnly(async (ctx) => {
    const chatId = ctx.chat.id;
    const user = await User.findOne({ telegramId: chatId });
    const userTimezone = user ? user.timezone : "Asia/Kolkata";
    const reminders = await getReminders(chatId);

    const { message, reply_markup } = buildRemindersView(reminders, user, userTimezone);
    ctx.reply(message, { parse_mode: "HTML", reply_markup });
  }));

  // Toggle Morning Summary
  bot.action("toggle_morning_summary", async (ctx) => {
    try {
      const chatId = ctx.chat?.id || ctx.from?.id;
      const user = await User.findOne({ telegramId: chatId });
      if (!user) return ctx.answerCbQuery("User not found");

      const currentStatus = user.preferences?.morningSummaryEnabled !== false;
      const newStatus = !currentStatus;

      user.preferences.morningSummaryEnabled = newStatus;
      if (newStatus && user.preferences.dailyRemindersEnabled === false) {
        user.preferences.dailyRemindersEnabled = true;
      }
      await user.save();

      await ctx.answerCbQuery(newStatus ? "🌅 Morning Briefing ENABLED!" : "🌅 Morning Briefing DISABLED!");

      const reminders = await getReminders(chatId);
      const { message, reply_markup } = buildRemindersView(reminders, user, user.timezone || "Asia/Kolkata");
      try {
        await ctx.editMessageText(message, { parse_mode: "HTML", reply_markup });
      } catch (e) {}
    } catch (err) {
      console.error("toggle_morning_summary error:", err);
      try { await ctx.answerCbQuery("Error updating setting"); } catch (e) {}
    }
  });

  // Toggle Nightly Reflection
  bot.action("toggle_night_reflection", async (ctx) => {
    try {
      const chatId = ctx.chat?.id || ctx.from?.id;
      const user = await User.findOne({ telegramId: chatId });
      if (!user) return ctx.answerCbQuery("User not found");

      const currentStatus = user.preferences?.nightlyReflectionEnabled !== false;
      const newStatus = !currentStatus;

      user.preferences.nightlyReflectionEnabled = newStatus;
      if (newStatus && user.preferences.dailyRemindersEnabled === false) {
        user.preferences.dailyRemindersEnabled = true;
      }
      await user.save();

      await ctx.answerCbQuery(newStatus ? "🌙 Nightly Check-In ENABLED!" : "🌙 Nightly Check-In DISABLED!");

      const reminders = await getReminders(chatId);
      const { message, reply_markup } = buildRemindersView(reminders, user, user.timezone || "Asia/Kolkata");
      try {
        await ctx.editMessageText(message, { parse_mode: "HTML", reply_markup });
      } catch (e) {}
    } catch (err) {
      console.error("toggle_night_reflection error:", err);
      try { await ctx.answerCbQuery("Error updating setting"); } catch (e) {}
    }
  });

  // Toggle Master Reminders
  bot.action("toggle_master_reminders", async (ctx) => {
    try {
      const chatId = ctx.chat?.id || ctx.from?.id;
      const user = await User.findOne({ telegramId: chatId });
      if (!user) return ctx.answerCbQuery("User not found");

      const currentStatus = user.preferences?.dailyRemindersEnabled !== false;
      const newStatus = !currentStatus;

      user.preferences.dailyRemindersEnabled = newStatus;
      await user.save();

      await ctx.answerCbQuery(newStatus ? "🔔 Daily Notifications UNMUTED!" : "🔕 All Daily Messages MUTED!");

      const reminders = await getReminders(chatId);
      const { message, reply_markup } = buildRemindersView(reminders, user, user.timezone || "Asia/Kolkata");
      try {
        await ctx.editMessageText(message, { parse_mode: "HTML", reply_markup });
      } catch (e) {}
    } catch (err) {
      console.error("toggle_master_reminders error:", err);
      try { await ctx.answerCbQuery("Error updating setting"); } catch (e) {}
    }
  });

  // Handle individual reminder deletion button
  bot.action(/^del_rem_(.+)$/, async (ctx) => {
    try {
      const reminderId = ctx.match[1];
      const chatId = ctx.chat?.id || ctx.from?.id;
      const user = await User.findOne({ telegramId: chatId });
      const userTimezone = user ? user.timezone : "Asia/Kolkata";

      const deleted = await Memory.findOneAndDelete({ _id: reminderId, chatId });
      if (deleted) {
        await ctx.answerCbQuery(`🗑️ Deleted: "${deleted.content}"`);
      } else {
        await ctx.answerCbQuery("Reminder already deleted.");
      }

      const reminders = await getReminders(chatId);
      const { message, reply_markup } = buildRemindersView(reminders, user, userTimezone);
      try {
        await ctx.editMessageText(message, { parse_mode: "HTML", reply_markup });
      } catch (e) {}
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
      const user = await User.findOne({ telegramId: chatId });
      const userTimezone = user ? user.timezone : "Asia/Kolkata";

      const res = await Memory.deleteMany({ chatId, type: "reminder" });
      await ctx.answerCbQuery(`🗑️ Deleted all ${res.deletedCount} reminders!`);

      const reminders = await getReminders(chatId);
      const { message, reply_markup } = buildRemindersView(reminders, user, userTimezone);
      try {
        await ctx.editMessageText(message, { parse_mode: "HTML", reply_markup });
      } catch (e) {}
    } catch (err) {
      console.error("del_rem_all action error:", err);
      try {
        await ctx.answerCbQuery("Error clearing reminders");
      } catch (e) {}
    }
  });
};

