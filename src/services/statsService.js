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
        modelLines += `  ├ ⚡ \`${readable}\`: ${v} calls\n`;
      }
    } else {
      modelLines = `  ├ ⚡ Amazon Nova Micro (Active)\n  └ 👁️ Amazon Nova Lite (Active)\n`;
    }

    let report = `👑 *ATHARVAOS LIVE SYSTEM DASHBOARD*\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    report += `👥 *USERS & ENGAGEMENT:*\n`;
    report += `• Total Registered Users: *${totalUsers || activeUsersCount}*\n`;
    report += `• Active Users (Last 24h): *${activeUsersCount}* 🔥\n`;
    report += `• Messages Processed (24h): *${todayMessages}*\n`;
    report += `• Lifetime Messages: *${totalMessages}*\n\n`;

    report += `🧠 *AI TOKEN METRICS (BEDROCK & LLM):*\n`;
    report += `• *Total Tokens Consumed:* *${totalTokens.toLocaleString()}* tokens\n`;
    report += `  ├ 📥 Prompt (Input): ${inputTokens.toLocaleString()} tokens\n`;
    report += `  └ 📤 Generated (Output): ${outputTokens.toLocaleString()} tokens\n`;
    report += `• *Total AI Invocations:* ${totalRequests.toLocaleString()}\n`;
    report += `• *Model Invocations:*\n${modelLines}\n`;

    report += `📋 *WORKSPACE & PRODUCTIVITY:*\n`;
    report += `• Total Tasks Tracked: *${totalTasks}*\n`;
    report += `• Tasks Completed: *${completedTasks}* (${completionRate}% rate)\n`;
    report += `• Pending Tasks: *${pendingTasks}*\n`;
    report += `• Active EventBridge Reminders: *${activeReminders}*\n\n`;

    report += `🎙️ *AMAZON POLLY VOICE:*\n`;
    report += `• Spoken Voice Notes Generated: *${voiceNotes}*\n\n`;

    report += `☁️ *INFRASTRUCTURE HEALTH:*\n`;
    report += `• Compute: *AWS Lambda (Node.js 22)* | \`ap-south-1\`\n`;
    report += `• Bedrock AI: *Account B (Multi-Model)* | Operational 🟢\n`;
    report += `• Database: *MongoDB Atlas Cluster* | Connected 🟢\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `_Owner: Atharva (@op_athu) • Live Realtime Snapshot_`;

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
