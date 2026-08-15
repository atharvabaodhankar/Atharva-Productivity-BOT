const User = require("../../models/User");
const Memory = require("../../models/Memory");
const History = require("../../models/History");
const { CHAT_ID } = require("../../config/env");

module.exports = (bot) => {
  bot.command(["admin", "stats"], async (ctx) => {
    const senderId = String(ctx.chat.id);
    const adminId = String(CHAT_ID);

    // Security check: Only the bot owner can view admin statistics
    if (adminId && senderId !== adminId) {
      return ctx.reply("⛔ Unauthorized! This command is only for the bot owner.");
    }

    try {
      const totalUsers = await User.countDocuments();
      const recentUsers = await User.find().sort({ createdAt: -1 }).limit(10);

      const totalTasks = await Memory.countDocuments();
      const pendingTasks = await Memory.countDocuments({ completed: false });
      const completedTasks = await Memory.countDocuments({ completed: true });
      const totalMessages = await History.countDocuments();

      let report = `📊 *ATHARVAOS BOT ANALYTICS*\n`;
      report += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

      report += `👥 *Total Users:* ${totalUsers}\n`;
      report += `📋 *Total Tasks Tracked:* ${totalTasks}\n`;
      report += `  ├ 🔥 Pending: ${pendingTasks}\n`;
      report += `  └ ✅ Completed: ${completedTasks}\n`;
      report += `💬 *Total AI Messages Exchanged:* ${totalMessages}\n\n`;

      report += `🌟 *Recent Registered Users (Last 10):*\n`;
      recentUsers.forEach((u, i) => {
        const usernameStr = u.username ? `(@${u.username})` : "";
        const joinedDate = new Date(u.createdAt).toLocaleDateString("en-US", {
          timeZone: "Asia/Kolkata",
        });
        report += `${i + 1}. *${u.firstName}* ${usernameStr}\n`;
        report += `   ID: \`${u.telegramId}\` | Joined: ${joinedDate}\n`;
      });

      report += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
      report += `_Owner: Atharva (Access Granted)_`;

      ctx.reply(report, { parse_mode: "Markdown" });
    } catch (err) {
      console.error("Admin stats error:", err);
      ctx.reply("❌ Error fetching analytics: " + err.message);
    }
  });
};
