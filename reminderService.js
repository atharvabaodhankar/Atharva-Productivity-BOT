const cron = require("node-cron");
const Memory = require("./memoryModel");

function startReminderService(bot) {

  // Runs every minute
  cron.schedule("* * * * *", async () => {

    const now = new Date();
    const nextHour = new Date(now.getTime() + 60 * 60 * 1000);

    const upcoming = await Memory.find({
      date: { $gte: now, $lte: nextHour }
    });

    for (let item of upcoming) {
      await bot.telegram.sendMessage(
        process.env.CHAT_ID,
        `⏰ Reminder: ${item.content}\nDue: ${new Date(item.date).toLocaleString()}`
      );
    }

  });
}

module.exports = { startReminderService };