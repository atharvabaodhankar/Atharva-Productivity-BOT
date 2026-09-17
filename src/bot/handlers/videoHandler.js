const { askAI } = require("../../ai/aiService");
const History = require("../../models/History");
const GroupConfig = require("../../models/GroupConfig");
const { sendTelegramFormatted } = require("../../utils/telegramFormatter");

function checkVideoBotMentionOrReply(ctx, rawCaption = "") {
  const isGroup = ctx.chat.type === "group" || ctx.chat.type === "supergroup";
  if (!isGroup) {
    return { shouldProcess: true, isMentioned: false, isReplyToBot: false, cleanCaption: rawCaption.trim() };
  }

  const botId = ctx.botInfo?.id || 7987805958;
  const botUsername = (ctx.botInfo?.username || "Atharva_Produtivity_Bot").toLowerCase();

  const replyMsg = ctx.message?.reply_to_message;
  const isReplyToBot = Boolean(
    replyMsg?.from?.is_bot &&
    (replyMsg.from.id === botId ||
      (replyMsg.from.username && replyMsg.from.username.toLowerCase() === botUsername) ||
      /@?atharva/i.test(replyMsg.from.username || ""))
  );

  const entities = ctx.message?.caption_entities || [];
  let isMentionedViaEntity = false;

  for (const ent of entities) {
    if (ent.type === "mention") {
      const mentionText = rawCaption.substring(ent.offset, ent.offset + ent.length).toLowerCase();
      if (
        mentionText === `@${botUsername}` ||
        mentionText === "@atharva_produtivity_bot" ||
        mentionText === "@atharva_productivity_bot" ||
        mentionText === "@atharvaos" ||
        mentionText.startsWith("@atharva")
      ) {
        isMentionedViaEntity = true;
        break;
      }
    } else if (ent.type === "text_mention") {
      if (ent.user && (ent.user.id === botId || ent.user.is_bot)) {
        isMentionedViaEntity = true;
        break;
      }
    }
  }

  const isMentionedViaRegex = /(?:^|\s)@(atharva_produtivity_bot|atharva_productivity_bot|atharvaos|atharva)/i.test(rawCaption);
  const isMentioned = isMentionedViaEntity || isMentionedViaRegex;

  if (!isMentioned && !isReplyToBot) {
    return { shouldProcess: false, isMentioned: false, isReplyToBot: false, cleanCaption: rawCaption.trim() };
  }

  const cleanCaption = rawCaption
    .replace(/@(atharva_produtivity_bot|atharva_productivity_bot|atharvaos|atharva\w*)/gi, "")
    .trim();

  return { shouldProcess: true, isMentioned, isReplyToBot, cleanCaption };
}

module.exports = (bot) => {
  bot.on(["video", "animation"], async (ctx) => {
    try {
      const chatId = ctx.chat.id;
      const rawCaption = ctx.message.caption || "";
      const chatType = ctx.chat.type;
      const isGroup = chatType === "group" || chatType === "supergroup";

      // 1. Group Chat Checks
      if (isGroup) {
        const config = await GroupConfig.findOne({ chatId });
        if (config && config.enabled === false) {
          return;
        }

        const mentionCheck = checkVideoBotMentionOrReply(ctx, rawCaption);
        if (!mentionCheck.shouldProcess) {
          return;
        }
      }

      const mentionResult = checkVideoBotMentionOrReply(ctx, rawCaption);
      const caption = mentionResult.cleanCaption;


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

      const sentMsg = await sendTelegramFormatted(ctx, reply, {
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
