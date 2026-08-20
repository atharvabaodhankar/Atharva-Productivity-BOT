const Memory = require("../models/Memory");
const User = require("../models/User");

// Helper to check if an error is permanent (user blocked, chat not found, bot kicked)
function isTelegramPermanentError(err) {
  const msg = (err?.message || "").toLowerCase();
  const code = err?.response?.error_code || err?.code;
  return (
    code === 403 ||
    code === 400 ||
    msg.includes("403") ||
    msg.includes("400") ||
    msg.includes("blocked") ||
    msg.includes("chat not found") ||
    msg.includes("can't initiate") ||
    msg.includes("deactivated") ||
    msg.includes("user is deactivated")
  );
}

// 1. Process 5-minute upcoming deadlines & scheduled routines
async function checkUpcomingReminders(bot) {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 1.1 Process Specific Deadlines & Reminder Alerts
    const upcoming = await Memory.find({
      date: { $lte: now, $gte: oneDayAgo },
      type: { $in: ["reminder", "task", "assignment", "exam", "project"] },
      completed: false,
      reminderSent: { $ne: true },
    });

    for (const item of upcoming) {
      if (item.chatId) {
        try {
          const user = await User.findOne({ telegramId: item.chatId });
          const name = user ? user.firstName : "Champ";

          let message = "";
          if (item.isRecurring) {
            const recurLabel = item.recurrenceInterval === "weekly" ? "Weekly" : item.recurrenceInterval === "weekdays" ? "Weekday" : "Daily";
            message = `🔁 *${recurLabel.toUpperCase()} REMINDER, ${name.toUpperCase()}!*\n\n📌 *${item.content}*\n\nTime to get this done! Stay consistent! 💪🔥`;
          } else {
            const funReminders = [
              `⏰ *REMINDER ALERT, ${name.toUpperCase()}!*\n\n📌 *${item.content}*\n\nTime's up! Let's get this done! 💪`,
              `🔔 *Ding Ding, ${name}!*\n\n🎯 *${item.content}*\n\nDue now! Time to conquer it! ✨`,
              `⚡ *DEADLINE ALERT!*\n\n📋 *${item.content}*\n\nYou got this, ${name}! Stay focused! 🔥`,
            ];
            message = funReminders[Math.floor(Math.random() * funReminders.length)];
          }

          await bot.telegram.sendMessage(item.chatId, message, { parse_mode: "Markdown" });

          // IF RECURRING REMINDER: Advance date to next occurrence (e.g. tomorrow) and reset reminderSent
          if (item.isRecurring && item.type === "reminder") {
            const nextDate = new Date(item.date || now);
            if (item.recurrenceInterval === "weekly") {
              nextDate.setDate(nextDate.getDate() + 7);
            } else if (item.recurrenceInterval === "weekdays") {
              const day = nextDate.getDay();
              nextDate.setDate(nextDate.getDate() + (day === 5 ? 3 : day === 6 ? 2 : 1));
            } else if (item.recurrenceInterval === "monthly") {
              nextDate.setMonth(nextDate.getMonth() + 1);
            } else {
              // Daily
              nextDate.setDate(nextDate.getDate() + 1);
            }

            while (nextDate <= now) {
              nextDate.setDate(nextDate.getDate() + 1);
            }

            await Memory.findByIdAndUpdate(item._id, {
              date: nextDate,
              reminderSent: false,
              completed: false,
            });
          } else if (item.type === "reminder") {
            // Pure one-time reminders: auto-complete immediately upon delivery
            await Memory.findByIdAndUpdate(item._id, { reminderSent: true, completed: true });
          } else {
            // Task/Deadline: mark reminderSent so it doesn't notify again
            await Memory.findByIdAndUpdate(item._id, { reminderSent: true });
          }
        } catch (err) {
          console.warn(`Failed sending reminder ${item._id}: ${err.message}`);
          // If Telegram rejected permanently (blocked, deleted chat), mark sent/completed so it doesn't loop
          if (isTelegramPermanentError(err)) {
            await Memory.findByIdAndUpdate(item._id, {
              reminderSent: true,
              completed: item.type === "reminder",
            });
          }
        }
      }
    }

    // 1.1.1 Auto-complete past expired ONE-TIME reminders so they never linger in pending lists
    await Memory.updateMany(
      {
        type: "reminder",
        completed: false,
        isRecurring: { $ne: true },
        $or: [
          { reminderSent: true },
          { date: { $lt: new Date(now.getTime() - 2 * 60 * 1000) } },
        ],
      },
      { completed: true, reminderSent: true }
    );

    // 1.1.2 If any recurring reminder fell behind in the past, advance its date to the future
    const overdueRecurring = await Memory.find({
      type: "reminder",
      isRecurring: true,
      completed: false,
      date: { $lt: oneDayAgo },
    });

    for (const rec of overdueRecurring) {
      const nextDate = new Date(rec.date || now);
      while (nextDate <= now) {
        nextDate.setDate(nextDate.getDate() + 1);
      }
      await Memory.findByIdAndUpdate(rec._id, { date: nextDate, reminderSent: false });
    }

    // 1.2 Process Morning Daily Briefings & Nightly Accountability in parallel batches
    const allUsers = await User.find();
    const userPromises = allUsers.map(async (user) => {
      const tz = user.timezone || "Asia/Kolkata";
      const userLocalDateStr = now.toLocaleDateString("en-CA", { timeZone: tz }); // YYYY-MM-DD
      const userHour = parseInt(
        now.toLocaleTimeString("en-US", { timeZone: tz, hour12: false, hour: "2-digit" }),
        10
      );

      // Morning Briefing: Trigger between 8 AM and 9 AM once per day
      if (userHour >= 8 && userHour < 9 && user.preferences?.lastDailySummaryDate !== userLocalDateStr) {
        await sendDailySummaryForUser(bot, user, userLocalDateStr);
      }

      // Nightly Accountability: Trigger between 10 PM (22) and 11 PM (23) once per day
      if (userHour >= 22 && userHour < 23 && user.preferences?.lastNightlyReflectionDate !== userLocalDateStr) {
        await sendNightlyReflectionForUser(bot, user, userLocalDateStr);
      }
    });

    // Execute in parallel with safety
    await Promise.allSettled(userPromises);
  } catch (error) {
    console.error("Error in checkUpcomingReminders:", error.message);
  }
}

// 2. Send Morning Daily Briefing for a specific user
async function sendDailySummaryForUser(bot, user, dateKey) {
  try {
    const chatId = user.telegramId;
    if (!chatId) return;

    const tz = user.timezone || "Asia/Kolkata";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayItems = await Memory.find({
      chatId,
      date: { $gte: today, $lt: tomorrow },
      type: { $in: ["task", "assignment", "project", "exam"] },
      completed: false,
    });

    const allPending = await Memory.find({
      chatId,
      type: { $in: ["task", "assignment", "project", "exam"] },
      completed: false,
    })
      .sort({ priority: 1, date: 1 })
      .limit(6);

    const name = user.firstName || "Champ";
    const greetings = [
      `🌅 *GOOD MORNING ${name.toUpperCase()}! Rise and grind! ☕*`,
      `🌞 *Wakey wakey, ${name}! Time to make today LEGENDARY! 🔥*`,
      `☀️ *Uth ja ${name}! Opportunities wait for no one! 💪*`,
      `🌄 *New day, new chances to level up, ${name}! Let's go! 🚀*`,
    ];

    let message = greetings[Math.floor(Math.random() * greetings.length)] + "\n\n";

    if (todayItems.length > 0) {
      message += "🔥 *DUE TODAY (Priority Mode ON):*\n";
      todayItems.forEach((item, i) => {
        const pEmoji = item.priority === "high" ? "🔥" : item.priority === "low" ? "🟢" : "⚡";
        message += `${i + 1}. ${pEmoji} *${item.content}*\n`;
      });
      message += "\n";
    }

    if (allPending.length > 0) {
      message += "📋 *Top Pending Focus Items:*\n";
      allPending.forEach((item, i) => {
        const pEmoji = item.priority === "high" ? "🔥" : item.priority === "low" ? "🟢" : "⚡";
        let dateStr = "";
        if (item.date) {
          dateStr = ` _(${new Date(item.date).toLocaleDateString("en-US", { timeZone: tz, month: "short", day: "numeric" })})_`;
        }
        message += `• ${pEmoji} ${item.content}${dateStr}\n`;
      });
    } else {
      message += "✨ *Your task plate is completely clean!* What are we conquering today, bhai?\n";
    }

    message += "\n━━━━━━━━━━━━━━━━━━━━━\n";
    message += "💪 _Let's make today count! Ready to crush it?_";

    await bot.telegram.sendMessage(chatId, message, { parse_mode: "Markdown" });

    // Mark today's summary as sent
    await User.findByIdAndUpdate(user._id, {
      "preferences.lastDailySummaryDate": dateKey,
    });
  } catch (err) {
    console.warn(`Error sending daily summary to ${user.telegramId}: ${err.message}`);
    // Always mark dateKey so we do not retry failed/blocked users every 5 minutes
    try {
      await User.findByIdAndUpdate(user._id, {
        "preferences.lastDailySummaryDate": dateKey,
      });
    } catch (dbErr) {}
  }
}

// 3. Send Nightly Accountability Check-In for a specific user
async function sendNightlyReflectionForUser(bot, user, dateKey) {
  try {
    const chatId = user.telegramId;
    if (!chatId) return;

    const name = user.firstName || "Champ";

    const pendingTasks = await Memory.find({
      chatId,
      type: { $in: ["task", "assignment", "project", "exam"] },
      completed: false,
    });

    const completedToday = await Memory.find({
      chatId,
      completed: true,
      updatedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    });

    let message = `🌙 *NIGHTLY ACCOUNTABILITY CHECK-IN*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (pendingTasks.length === 0) {
      message += `🏆 *BOOM! Zero pending tasks left, ${name}!* You completely dominated today! Sahi hai yaar! 🔥\n\n`;
      message += `What was your biggest win today? Batade, let's celebrate it! ✍️`;
    } else {
      message += `Bhai ${name}, day end hone wala hai! ⏰ Let's do a quick accountability check:\n\n`;
      message += `📋 *Still Pending (${pendingTasks.length} items):*\n`;
      pendingTasks.slice(0, 5).forEach((t, i) => {
        message += `${i + 1}. ⏳ *${t.content}*\n`;
      });

      if (completedToday.length > 0) {
        message += `\n✅ *Crushed Today (${completedToday.length} items):*\n`;
        completedToday.slice(0, 3).forEach((t) => {
          message += `• ${t.content}\n`;
        });
      }

      message += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
      message += `✍️ *Kya hua bhai? Did you finish any of these, ya kal par taal diya?*\n`;
      message += `_Reply with "done with [task name]" to mark it done, or tell me how today went!_ 💪`;
    }

    await bot.telegram.sendMessage(chatId, message, { parse_mode: "Markdown" });

    // Mark tonight's reflection as sent
    await User.findByIdAndUpdate(user._id, {
      "preferences.lastNightlyReflectionDate": dateKey,
    });
  } catch (err) {
    console.warn(`Error sending nightly reflection to ${user.telegramId}: ${err.message}`);
    // Always mark dateKey so we do not retry failed/blocked users every 5 minutes
    try {
      await User.findByIdAndUpdate(user._id, {
        "preferences.lastNightlyReflectionDate": dateKey,
      });
    } catch (dbErr) {}
  }
}

// 4. Batch Helpers (backward compatible)
async function sendDailySummary(bot) {
  const users = await User.find();
  const dateKey = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  await Promise.allSettled(users.map((user) => sendDailySummaryForUser(bot, user, dateKey)));
}

async function sendNightlyReflection(bot) {
  const users = await User.find();
  const dateKey = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  await Promise.allSettled(users.map((user) => sendNightlyReflectionForUser(bot, user, dateKey)));
}

module.exports = {
  checkUpcomingReminders,
  sendDailySummary,
  sendNightlyReflection,
  sendDailySummaryForUser,
  sendNightlyReflectionForUser,
};
