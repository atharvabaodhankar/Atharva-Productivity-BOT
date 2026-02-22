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
            await bot.telegram.sendMessage(
              chatId,
              `⏰ Reminder: ${item.content}\nDue: ${new Date(item.date).toLocaleString()}`
            );
            
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
          let message = "🌅 Good Morning! Here's your daily summary:\n\n";

          if (todayItems.length > 0) {
            message += "📌 Due Today:\n";
            todayItems.forEach((item) => {
              message += `• ${item.content}\n`;
            });
            message += "\n";
          }

          if (allPending.length > 0) {
            message += "📋 Upcoming:\n";
            allPending.forEach((item) => {
              message += `• ${item.content}`;
              if (item.date) {
                message += ` (${new Date(item.date).toDateString()})`;
              }
              message += "\n";
            });
          }

          message += "\n💪 Let's make today productive!";

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