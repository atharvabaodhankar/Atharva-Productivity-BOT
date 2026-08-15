const { askAI } = require("../../ai/aiService");
const History = require("../../models/History");
const GroupConfig = require("../../models/GroupConfig");

const MENTION_REGEX = /@Atharva_Produtivity_Bot|@Atharva_Productivity_Bot|@AtharvaOS/gi;

module.exports = (bot) => {
  bot.on(["video", "animation"], async (ctx) => {
    try {
      const chatId = ctx.chat.id;
      let caption = (ctx.message.caption || "").trim();
      const chatType = ctx.chat.type;
      const isGroup = chatType === "group" || chatType === "supergroup";

      // 1. Group Chat Checks
      if (isGroup) {
        const config = await GroupConfig.findOne({ chatId });
        if (!config || !config.enabled) {
          return;
        }

        const isMentioned =
          MENTION_REGEX.test(caption) ||
          ctx.message.caption_entities?.some(
            (e) =>
              e.type === "mention" &&
              /@Atharva_Produtivity_Bot/i.test(caption.substring(e.offset, e.offset + e.length))
          );

        const isReplyToBot =
          ctx.message.reply_to_message?.from?.is_bot &&
          (ctx.message.reply_to_message?.from?.id === 7987805958 ||
            /@Atharva_Produtivity_Bot/i.test(ctx.message.reply_to_message?.from?.username || ""));

        if (!isMentioned && !isReplyToBot) {
          return;
        }

        caption = caption.replace(MENTION_REGEX, "").trim();
      }

      const history = await History.find({ chatId })
        .sort({ createdAt: -1 })
        .limit(5);

      const historyContext = history
        .reverse()
        .map((h) => `${h.role}: ${h.content}`)
        .join("\n");

      const userMessage = caption ? `[Sent a Video]: ${caption}` : "[Sent a Video]";

      const reply = await askAI({
        message: userMessage,
        chatId,
        historyContext,
        isGroup,
        senderName: ctx.from?.first_name || "Friend",
      });

      const sentMsg = await ctx.reply(reply, {
        reply_to_message_id: isGroup ? ctx.message.message_id : undefined,
      });

      // Save history with telegramMessageId for full deletion/edit support
      await History.create({
        chatId,
        role: "user",
        content: caption ? `[Video] ${caption}` : "[Video]",
        telegramMessageId: ctx.message.message_id,
      });
      await History.create({
        chatId,
        role: "assistant",
        content: reply,
        telegramMessageId: sentMsg.message_id,
      });
    } catch (error) {
      console.error("Video handler error:", error);
      ctx.reply("Arre yaar, something went wrong while processing the video! 😅");
    }
  });
};
