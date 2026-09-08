const { getSystemMetrics } = require("../../services/statsService");
const { getPendingTasks, getReminders } = require("../../services/memoryService");
const { sendAiVoiceReply } = require("../../services/voiceService");
const { executeBedrockConverse, isBedrockConfigured } = require("../../ai/bedrockService");
const { CHAT_ID } = require("../../config/env");
const { Markup } = require("telegraf");

function isOwner(ctx) {
  const senderId = String(ctx.chat?.id || ctx.from?.id || "");
  const username = (ctx.from?.username || "").toLowerCase().replace(/^@/, "");
  const adminId = String(process.env.CHAT_ID || CHAT_ID || "5275149287").trim();
  return senderId === adminId || senderId === "5275149287" || username === "op_athu";
}

function getCreatorKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("🔄 Refresh Live Stats", "cb_creator_stats"),
      Markup.button.callback("📋 My Tasks", "cb_creator_tasks"),
    ],
    [
      Markup.button.callback("⏰ Active Reminders", "cb_creator_reminders"),
      Markup.button.callback("🎙️ Test Voice Note", "cb_creator_voice"),
    ],
    [
      Markup.button.callback("🧠 Bedrock Health", "cb_creator_bedrock"),
    ],
  ]);
}

module.exports = (bot) => {
  bot.command(["admin", "stats", "metrics", "creator"], async (ctx) => {
    if (!isOwner(ctx)) {
      return ctx.reply("⛔ Unauthorized! This command is strictly reserved for Atharva.");
    }

    try {
      const report = await getSystemMetrics();
      await ctx.reply(report, {
        parse_mode: "Markdown",
        reply_markup: getCreatorKeyboard().reply_markup,
      });
    } catch (err) {
      console.error("Admin stats error:", err);
      ctx.reply("❌ Error fetching analytics: " + err.message);
    }
  });

  // 1. Refresh Live Stats Action
  bot.action("cb_creator_stats", async (ctx) => {
    if (!isOwner(ctx)) return ctx.answerCbQuery("⛔ Owner access only.");
    try {
      await ctx.answerCbQuery("Refreshing live metrics... 🔄");
      const report = await getSystemMetrics();
      try {
        await ctx.editMessageText(report, {
          parse_mode: "Markdown",
          reply_markup: getCreatorKeyboard().reply_markup,
        });
      } catch (e) {
        // Fallback if content is unchanged
      }
    } catch (err) {
      console.error("cb_creator_stats error:", err);
    }
  });

  // 2. View Atharva's Pending Tasks
  bot.action("cb_creator_tasks", async (ctx) => {
    if (!isOwner(ctx)) return ctx.answerCbQuery("⛔ Owner access only.");
    try {
      await ctx.answerCbQuery("Fetching your tasks...");
      const chatId = ctx.chat?.id || ctx.from?.id;
      const tasks = await getPendingTasks(chatId);

      if (tasks.length === 0) {
        return ctx.reply("🎉 No pending tasks right now, Boss! All clear.");
      }

      let msg = `📋 *ATHARVA'S ACTIVE TASKS:*\n━━━━━━━━━━━━━━━━━\n`;
      tasks.slice(0, 10).forEach((t, i) => {
        msg += `${i + 1}. *${t.content}*\n`;
      });
      ctx.reply(msg, { parse_mode: "Markdown" });
    } catch (err) {
      console.error("cb_creator_tasks error:", err);
    }
  });

  // 3. View Active Reminders
  bot.action("cb_creator_reminders", async (ctx) => {
    if (!isOwner(ctx)) return ctx.answerCbQuery("⛔ Owner access only.");
    try {
      await ctx.answerCbQuery("Fetching active reminders...");
      const chatId = ctx.chat?.id || ctx.from?.id;
      const rems = await getReminders(chatId);

      if (rems.length === 0) {
        return ctx.reply("⏰ No active reminders scheduled right now.");
      }

      let msg = `⏰ *ACTIVE DEADLINE REMINDERS:*\n━━━━━━━━━━━━━━━━━━━━\n`;
      rems.forEach((r, i) => {
        const timeStr = r.date ? new Date(r.date).toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }) : "";
        msg += `${i + 1}. *${r.content}* ${timeStr ? `(Due: ${timeStr})` : ""}\n`;
      });
      ctx.reply(msg, { parse_mode: "Markdown" });
    } catch (err) {
      console.error("cb_creator_reminders error:", err);
    }
  });

  // 4. Test Voice Synthesis
  bot.action("cb_creator_voice", async (ctx) => {
    if (!isOwner(ctx)) return ctx.answerCbQuery("⛔ Owner access only.");
    try {
      await ctx.answerCbQuery("Synthesizing voice briefing... 🎙️");
      const chatId = ctx.chat?.id || ctx.from?.id;
      await sendAiVoiceReply(
        bot,
        chatId,
        "Hey Atharva! Systems are all operational on Amazon Bedrock and AWS Lambda. Let's conquer the day!",
        { caption: "🎙️ <i>Amazon Polly Matthew Voice Test</i>" }
      );
    } catch (err) {
      console.error("cb_creator_voice error:", err);
      ctx.reply("❌ Polly voice test error: " + err.message);
    }
  });

  // 5. Test Bedrock Health Check
  bot.action("cb_creator_bedrock", async (ctx) => {
    if (!isOwner(ctx)) return ctx.answerCbQuery("⛔ Owner access only.");
    try {
      await ctx.answerCbQuery("Pinging Amazon Bedrock... 🧠");
      const start = Date.now();
      const res = await executeBedrockConverse({
        messages: [{ role: "user", content: "Ping! Confirm system status in 8 words." }],
        systemPrompt: "You are AtharvaOS core.",
      });
      const latency = Date.now() - start;

      ctx.reply(
        `🟢 *AMAZON BEDROCK HEALTH CHECK*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `• Model: \`apac.amazon.nova-micro-v1:0\`\n` +
        `• Status: *Online & Responding*\n` +
        `• Round-trip Latency: *${latency} ms*\n` +
        `• AI Response: _"${res}"_`,
        { parse_mode: "Markdown" }
      );
    } catch (err) {
      console.error("cb_creator_bedrock error:", err);
      ctx.reply("❌ Bedrock ping error: " + err.message);
    }
  });
};
