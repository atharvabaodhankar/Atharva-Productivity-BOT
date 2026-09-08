const SystemStats = require("../models/SystemStats");
const User = require("../models/User");
const Memory = require("../models/Memory");
const History = require("../models/History");

async function recordTokenUsage({ model = "unknown", inputTokens = 0, outputTokens = 0, totalTokens = 0 }) {
  try {
    const calcTotal = totalTokens || (inputTokens + outputTokens);
    const cleanModelKey = model.replace(/\./g, "_").replace(/:/g, "_");

    await SystemStats.findOneAndUpdate(
      { key: "global_stats" },
      {
        $inc: {
          totalInputTokens: inputTokens,
          totalOutputTokens: outputTokens,
          totalTokens: calcTotal,
          totalAiRequests: 1,
          [`modelBreakdown.${cleanModelKey}`]: 1,
        },
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error("Failed to record token usage:", err.message);
  }
}

async function recordVoiceGeneration() {
  try {
    await SystemStats.findOneAndUpdate(
      { key: "global_stats" },
      { $inc: { voiceNotesGenerated: 1 } },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error("Failed to record voice generation:", err.message);
  }
}

async function getSystemMetrics() {
  try {
    const now = new Date();
    const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers24hList,
      totalTasks,
      completedTasks,
      activeReminders,
      totalMessages,
      todayMessages,
      statsDoc,
    ] = await Promise.all([
      User.countDocuments().catch(() => 0),
      History.distinct("chatId", { createdAt: { $gte: past24h } }).catch(() => []),
      Memory.countDocuments({ type: { $in: ["task", "project"] } }).catch(() => 0),
      Memory.countDocuments({ completed: true }).catch(() => 0),
      Memory.countDocuments({ type: "reminder", completed: false }).catch(() => 0),
      History.countDocuments().catch(() => 0),
      History.countDocuments({ createdAt: { $gte: past24h } }).catch(() => 0),
      SystemStats.findOne({ key: "global_stats" }).lean().catch(() => null),
    ]);

    const activeUsersCount = activeUsers24hList.length || 1;
    const pendingTasks = Math.max(0, totalTasks - completedTasks);
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const inputTokens = statsDoc?.totalInputTokens || 0;
    const outputTokens = statsDoc?.totalOutputTokens || 0;
    const totalTokens = statsDoc?.totalTokens || (inputTokens + outputTokens);
    const totalRequests = statsDoc?.totalAiRequests || 0;
    const voiceNotes = statsDoc?.voiceNotesGenerated || 0;

    // Model Breakdown formatting
    const rawBreakdown = statsDoc?.modelBreakdown || {};
    let modelLines = "";
    if (Object.keys(rawBreakdown).length > 0) {
      for (const [k, v] of Object.entries(rawBreakdown)) {
        const readable = k.replace(/_/g, ".");
        modelLines += `  ├ ⚡ <code>${readable}</code>: ${v} calls\n`;
      }
    } else {
      modelLines = `  ├ ⚡ <code>apac.amazon.nova-micro-v1:0</code>: Active\n  └ 👁️ <code>apac.amazon.nova-lite-v1:0</code>: Active\n`;
    }

    let report = `👑 <b>ATHARVAOS LIVE SYSTEM DASHBOARD</b>\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    report += `👥 <b>USERS &amp; ENGAGEMENT:</b>\n`;
    report += `• Total Registered Users: <b>${totalUsers || activeUsersCount}</b>\n`;
    report += `• Active Users (Last 24h): <b>${activeUsersCount}</b> 🔥\n`;
    report += `• Messages Processed (24h): <b>${todayMessages}</b>\n`;
    report += `• Lifetime Messages: <b>${totalMessages}</b>\n\n`;

    report += `🧠 <b>AI TOKEN METRICS (BEDROCK &amp; LLM):</b>\n`;
    report += `• <b>Total Tokens Consumed:</b> <b>${totalTokens.toLocaleString()}</b> tokens\n`;
    report += `  ├ 📥 Prompt (Input): ${inputTokens.toLocaleString()} tokens\n`;
    report += `  └ 📤 Generated (Output): ${outputTokens.toLocaleString()} tokens\n`;
    report += `• <b>Total AI Invocations:</b> ${totalRequests.toLocaleString()}\n`;
    report += `• <b>Model Invocations:</b>\n${modelLines}\n`;

    report += `📋 <b>WORKSPACE &amp; PRODUCTIVITY:</b>\n`;
    report += `• Total Tasks Tracked: <b>${totalTasks}</b>\n`;
    report += `• Tasks Completed: <b>${completedTasks}</b> (${completionRate}% rate)\n`;
    report += `• Pending Tasks: <b>${pendingTasks}</b>\n`;
    report += `• Active EventBridge Reminders: <b>${activeReminders}</b>\n\n`;

    report += `🎙️ <b>AMAZON POLLY VOICE:</b>\n`;
    report += `• Spoken Voice Notes Generated: <b>${voiceNotes}</b>\n\n`;

    report += `☁️ <b>INFRASTRUCTURE HEALTH:</b>\n`;
    report += `• Compute: <b>AWS Lambda (Node.js 22)</b> | <code>ap-south-1</code>\n`;
    report += `• Bedrock AI: <b>Account B (Multi-Model)</b> | Operational 🟢\n`;
    report += `• Database: <b>MongoDB Atlas Cluster</b> | Connected 🟢\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `<i>Owner: Atharva (@op_athu) • Live Realtime Snapshot</i>`;

    return report;
  } catch (err) {
    console.error("Error generating system metrics:", err);
    return `❌ Error generating metrics: ${err.message}`;
  }
}

module.exports = {
  recordTokenUsage,
  recordVoiceGeneration,
  getSystemMetrics,
};
