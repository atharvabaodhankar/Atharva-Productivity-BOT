const cron = require("node-cron");
const Memory = require("./memoryModel");

function startReminderService(bot) {
  // Track sent reminders to avoid duplicates
  const sentReminders = new Set();

  // Runs every minute
  cron.schedule("* * * * *", async () => {
    const now = new Date();

    // Find items that are due (date is in the past or within the next minute)
    const upcoming = await Memory.find({
      date: { $lte: now },
      type: { $in: ["reminder", "task", "assignment", "exam", "project"] }
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
            
            // Optional: Delete the reminder after sending
            await Memory.findByIdAndDelete(item._id);
          }
        } catch (error) {
          console.error("Error sending reminder:", error.message);
        }
      }
    }
  });

  console.log("✅ Reminder service started");
}

module.exports = { startReminderService };