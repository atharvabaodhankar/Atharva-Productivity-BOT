const cron = require("node-cron");
const Memory = require("./memoryModel");

function startReminderService(bot) {
  // Track sent reminders to avoid duplicates
  const sentReminders = new Set();

  // Runs every minute - check for due reminders
  cron.schedule("* * * * *", async () => {
    const now = new Date();

    // Find items that are due (date is in the past or within the next minute)
    const upcoming = await Memory.find({
      date: { $lte: now },
      type: { $in: ["reminder", "task", "assignment", "exam", "project"] },
      completed: false,
    });

    for (let item of upcoming) {
      const reminderId = item._id.toString();
      
      // Only send if not already sent
      if (!sentReminders.has(reminderId)) {
        try {
          // Use the chatId stored with the memory instead of env variable
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
            
            // Mark as sent
            sentReminders.add(reminderId);
            
            // Mark as completed instead of deleting
            await Memory.findByIdAndUpdate(item._id, { completed: true });
          }
        } catch (error) {
          console.error("Error sending reminder:", error.message);
        }
      }
    }
  });

  // Daily summary at 8 AM
  cron.schedule("0 8 * * *", async () => {
    try {
      // Get all unique chat IDs
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
      console.error("Error sending daily summary:", error.message);
    }
  });

  console.log("✅ Reminder service started");
  console.log("✅ Daily summary scheduled for 8:00 AM");
}

module.exports = { startReminderService };