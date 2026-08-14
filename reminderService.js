const cron = require("node-cron");
const Memory = require("./memoryModel");

// Track sent reminders in-memory (best-effort for long-running; for Lambda, completed flag handles it)
const sentReminders = new Set();

async function checkUpcomingReminders(bot) {
  try {
    const now = new Date();
    // Find items that are due (date is in the past or within the next minute)
    const upcoming = await Memory.find({
      date: { $lte: now },
      type: { $in: ["reminder", "task", "assignment", "exam", "project"] },
      completed: false,
    });

    for (let item of upcoming) {
      const reminderId = item._id.toString();
      
      if (!sentReminders.has(reminderId)) {
        const chatId = item.chatId;
        if (chatId) {
          const funReminders = [
            `⏰ YO! Time's up!\n\n🎯 ${item.content}\n\nLet's gooo! No excuses! 💪`,
            `🔔 Ding ding ding!\n\n📌 ${item.content}\n\nChal bhai, time to shine! ✨`,
            `⚡ REMINDER ALERT!\n\n🎯 ${item.content}\n\nYou got this, champ! 🔥`,
            `🚨 Arre bhai!\n\n📋 ${item.content}\n\nDue: ${new Date(item.date).toLocaleString()}\n\nGet on it! 🚀`
          ];
          
          const message = funReminders[Math.floor(Math.random() * funReminders.length)];
          await bot.telegram.sendMessage(chatId, message);
          
          sentReminders.add(reminderId);
          await Memory.findByIdAndUpdate(item._id, { completed: true });
        }
      }
    }
  } catch (error) {
    console.error("Error in checkUpcomingReminders:", error.message);
  }
}

async function sendDailySummary(bot) {
  try {
    const users = await Memory.distinct("chatId");

    for (let chatId of users) {
      if (!chatId) continue;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayItems = await Memory.find({
        chatId,
        date: { $gte: today, $lt: tomorrow },
        completed: false,
      });

      const allPending = await Memory.find({
        chatId,
        type: { $in: ["task", "assignment", "project", "exam"] },
        completed: false,
      }).sort({ date: 1 }).limit(5);

      if (todayItems.length > 0 || allPending.length > 0) {
        const greetings = [
          "🌅 GOOD MORNING, CHAMPION! Rise and grind! ☕",
          "🌞 Wakey wakey! Time to make today LEGENDARY! 🔥",
          "☀️ Uth ja bhai! Opportunities wait for no one! 💪",
          "🌄 New day, new chances to be AWESOME! Let's go! 🚀"
        ];
        
        let message = greetings[Math.floor(Math.random() * greetings.length)] + "\n\n";

        if (todayItems.length > 0) {
          message += "🔥 DUE TODAY (Priority mode ON!):\n";
          todayItems.forEach((item) => {
            message += `• ${item.content}\n`;
          });
          message += "\n";
        }

        if (allPending.length > 0) {
          message += "📋 Coming Up Soon:\n";
          allPending.forEach((item) => {
            message += `• ${item.content}`;
            if (item.date) {
              message += ` (${new Date(item.date).toDateString()})`;
            }
            message += "\n";
          });
        }

        const endings = [
          "\n💪 Let's make today COUNT! You got this! 🎯",
          "\n🚀 Time to show the world what you're made of! 💯",
          "\n⚡ One step at a time, you'll conquer it all! 🏆",
          "\n🔥 Today's the day! Let's CRUSH these goals! 💪"
        ];

        message += endings[Math.floor(Math.random() * endings.length)];
        await bot.telegram.sendMessage(chatId, message);
      }
    }
  } catch (error) {
    console.error("Error in sendDailySummary:", error.message);
  }
}

async function sendNightlyReflection(bot) {
  try {
    const users = await Memory.distinct("chatId");
    for (let chatId of users) {
      if (!chatId) continue;
      
      const prompts = [
        "Bhai, day end hone wala hai! 🌅 Aaj kya ukhada? 📒 Kuch seekha ya bas chill kiya? Batade, memory mein save kar leta hoon! 💪",
        "Ayee! Time for nightly reflection! 🌙 Pure din mein sabse best cheez kya thi aaj? ✍️ Let's wrap up today like a champ!",
        "Arre yaar, bed par jaane se pehle batade - what did you achieve today? 🏆 Chhota ho ya bada, win is a win! Let's log it! 🔥",
        "Yooo! Today's mission update? 🚀 Aaj ka din kaisa raha? Key highlight batade bhai! 📒"
      ];
      
      const message = prompts[Math.floor(Math.random() * prompts.length)];
      await bot.telegram.sendMessage(chatId, message);
    }
  } catch (error) {
    console.error("Error in sendNightlyReflection:", error.message);
  }
}

function startReminderService(bot) {
  // Runs every minute - check for due reminders
  cron.schedule("* * * * *", () => checkUpcomingReminders(bot));

  // Daily summary at 8 AM
  cron.schedule("0 8 * * *", () => sendDailySummary(bot));

  // Nightly reflection at 10 PM
  cron.schedule("0 22 * * *", () => sendNightlyReflection(bot));

  console.log("✅ Reminder service started (node-cron)");
}

module.exports = {
  startReminderService,
  checkUpcomingReminders,
  sendDailySummary,
  sendNightlyReflection
};