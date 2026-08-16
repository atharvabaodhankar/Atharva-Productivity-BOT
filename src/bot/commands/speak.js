const { askAI } = require("../../ai/aiService");
const { checkVoiceQuota, sendAiVoiceReply, DAILY_VOICE_LIMIT } = require("../../services/voiceService");
const User = require("../../models/User");
const History = require("../../models/History");

module.exports = (bot) => {
  bot.command(["speak", "voice", "audio", "bol"], async (ctx) => {
    try {
      const chatId = ctx.chat.id;
      const fullText = (ctx.message.text || "").trim();
      const prompt = fullText.replace(/^\/(speak|voice|audio|bol)(@\w+)?\s*/i, "").trim();
      const isGroup = ctx.chat.type === "group" || ctx.chat.type === "supergroup";

      // 1. Quota Check
      const quota = await checkVoiceQuota(chatId);
      if (!quota.allowed) {
        return ctx.reply(
          `⚠️ <b>Daily Voice Limit Reached!</b>\n\nYou have used all <b>${DAILY_VOICE_LIMIT} free AI voice notes</b> for today.\n\nQuota resets at midnight! You can still chat with text as much as you like. 🚀`,
          { parse_mode: "HTML", reply_to_message_id: isGroup ? ctx.message.message_id : undefined }
        );
      }

      // 2. If no prompt provided, show usage help
      if (!prompt) {
        const remainingTag = quota.isOwner ? "Unlimited (Creator POV)" : `${quota.remaining} remaining today`;
        return ctx.reply(
          `🎙️ <b>AtharvaOS AI Voice Copilot (Matthew Voice)</b>\n\n` +
          `Usage: <code>/speak &lt;your question or prompt&gt;</code>\n\n` +
          `<b>Examples:</b>\n` +
          `• <code>/speak Give me a high-energy motivational speech!</code>\n` +
          `• <code>/speak What are the 3 laws of productivity?</code>\n` +
          `• <code>/speak Summarize my daily mindset for today</code>\n\n` +
          `<i>Daily Quota: ${remainingTag}</i>`,
          { parse_mode: "HTML", reply_to_message_id: isGroup ? ctx.message.message_id : undefined }
        );
      }

      // 3. Inform user and show Telegram "Recording Voice" action
      await ctx.sendChatAction("record_voice");

      // Save user prompt in history
      await History.create({
        chatId: Number(chatId),
        role: "user",
        content: `[Voice Request]: ${prompt}`,
        telegramMessageId: ctx.message.message_id,
      });

      // 4. Generate AI response via Groq askAI
      const replyText = await askAI({
        message: `${prompt}\n\n[Note: Please reply concisely in a conversational spoken tone under 70 words, suitable for a voice note speech.]`,
        chatId,
        isGroup,
        senderName: ctx.from?.first_name || "Friend",
      });

      // 5. Synthesize speech and send native Telegram Voice Note
      try {
        const remainingStr = quota.isOwner ? "Creator Clearance" : `${quota.remaining} voice notes left today`;
        await sendAiVoiceReply(bot, chatId, replyText, {
          caption: `🎙️ <b>AtharvaOS Voice Note</b>\n\n<i>Voice: Matthew (AWS Polly) • ${remainingStr}</i>`,
          replyToMessageId: isGroup ? ctx.message.message_id : undefined,
        });
      } catch (voiceErr) {
        console.error("Polly Voice Dispatch Error:", voiceErr.message);
        await ctx.reply(
          `🎙️ <i>(Voice audio fallback)</i>\n\n${replyText}`,
          { parse_mode: "HTML", reply_to_message_id: isGroup ? ctx.message.message_id : undefined }
        );
      }
    } catch (err) {
      console.error("/speak command error:", err);
      try {
        await ctx.reply("Arre yaar, voice note generate karne me error aayi. Please try again! 😅");
      } catch (e) {}
    }
  });
};
