const { askAI } = require("../../ai/aiService");
const History = require("../../models/History");
const GroupConfig = require("../../models/GroupConfig");
const {
  checkEasterEggOrNsfw,
  triggerAlertAndNotify,
  getRandomResponse,
} = require("../../utils/easterEggDetector");
const { sendTelegramFormatted, sendTelegramHumanPaced } = require("../../utils/telegramFormatter");

function checkBotMentionOrReply(ctx, rawText = "") {
  const isGroup = ctx.chat.type === "group" || ctx.chat.type === "supergroup";
  if (!isGroup) {
    return { shouldProcess: true, isMentioned: false, isReplyToBot: false, cleanText: rawText.trim() };
  }

  const botId = ctx.botInfo?.id || 7987805958;
  const botUsername = (ctx.botInfo?.username || "Atharva_Produtivity_Bot").toLowerCase();

  // 1. Check if user is replying directly to any of the bot's messages
  const replyMsg = ctx.message?.reply_to_message;
  const isReplyToBot = Boolean(
    replyMsg?.from?.is_bot &&
    (replyMsg.from.id === botId ||
      (replyMsg.from.username && replyMsg.from.username.toLowerCase() === botUsername) ||
      /@?atharva/i.test(replyMsg.from.username || ""))
  );

  // 2. Check if bot is mentioned via Telegram entities
  const entities = ctx.message?.entities || [];
  let isMentionedViaEntity = false;

  for (const ent of entities) {
    if (ent.type === "mention") {
      const mentionText = rawText.substring(ent.offset, ent.offset + ent.length).toLowerCase();
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

  // 3. Check if bot is mentioned via plain text (stateless regex)
  const isMentionedViaRegex = /(?:^|\s)@(atharva_produtivity_bot|atharva_productivity_bot|atharvaos|atharva)/i.test(rawText);

  const isMentioned = isMentionedViaEntity || isMentionedViaRegex;

  if (!isMentioned && !isReplyToBot) {
    return { shouldProcess: false, isMentioned: false, isReplyToBot: false, cleanText: rawText.trim() };
  }

  // Clean mention from prompt text
  const cleanText = rawText
    .replace(/@(atharva_produtivity_bot|atharva_productivity_bot|atharvaos|atharva\w*)/gi, "")
    .trim();

  return {
    shouldProcess: true,
    isMentioned,
    isReplyToBot,
    cleanText,
  };
}

module.exports = (bot) => {
  bot.on("text", async (ctx) => {
    try {
      const rawMessage = ctx.message.text || "";
      const chatId = ctx.chat.id;
      const chatType = ctx.chat.type;
      const isGroup = chatType === "group" || chatType === "supergroup";

      // 1. Group Chat Checks
      if (isGroup) {
        const config = await GroupConfig.findOne({ chatId });
        if (config && config.enabled === false) {
          // Bot was explicitly turned OFF in this group by owner -> Silently ignore
          return;
        }

        const mentionCheck = checkBotMentionOrReply(ctx, rawMessage);
        if (!mentionCheck.shouldProcess) {
          return;
        }

        if (!mentionCheck.cleanText && !mentionCheck.isReplyToBot) {
          return ctx.reply("Haan bhai! Kaho, kaise madad karu? 🚀", {
            reply_to_message_id: ctx.message.message_id,
          });
        }
      }

      const mentionResult = checkBotMentionOrReply(ctx, rawMessage);
      let userMessage = mentionResult.cleanText || rawMessage.trim();


      // 1.5 Check if user is replying to NSFW Meme confirmation (YES / NO)
      const User = require("../../models/User");
      const { requestOwnerMemeApproval } = require("../../services/memeService");
      const userDoc = await User.findOne({ telegramId: chatId });

      if (userDoc && userDoc.awaitingMemeConfirmation) {
        const cleanText = userMessage.toLowerCase().trim();
        const isYes = /\b(yes|haan|ha|yeah|yep|y|pakka|18\+|ok|sure|show)\b/i.test(cleanText);
        const isNo = /\b(no|nahi|na|nope|n|cancel|rehne do)\b/i.test(cleanText);

        if (isYes) {
          userDoc.awaitingMemeConfirmation = false;
          await userDoc.save();

          const waitMsg =
            "Theek hai bhai, hold tight! ⏳ Finding the spiciest meme from Reddit for you...";

          const sentMsg = await ctx.reply(waitMsg, {
            reply_to_message_id: isGroup ? ctx.message.message_id : undefined,
          });

          await History.create({ chatId, role: "user", content: userMessage, telegramMessageId: ctx.message.message_id });
          await History.create({ chatId, role: "assistant", content: waitMsg, telegramMessageId: sentMsg.message_id });

          // Send approval request to owner Telegram & Mission Control
          try {
            await requestOwnerMemeApproval(bot, {
              chatId,
              userName: ctx.from?.first_name || "Friend",
              username: ctx.from?.username || "",
            });
          } catch (memeApprErr) {
            console.error("Failed to request owner meme approval:", memeApprErr.message);
          }
          return;
        } else if (isNo) {
          userDoc.awaitingMemeConfirmation = false;
          await userDoc.save();

          const cancelText = "Good boy/girl! 😇 Sharafat me hi bhalai hai. Chalo wapas focus karo apne goals aur tasks pe! 🚀✨";

          const sentMsg = await ctx.reply(cancelText, {
            reply_to_message_id: isGroup ? ctx.message.message_id : undefined,
          });

          await History.create({ chatId, role: "user", content: userMessage, telegramMessageId: ctx.message.message_id });
          await History.create({ chatId, role: "assistant", content: cancelText, telegramMessageId: sentMsg.message_id });
          return;
        }
      }

      // 1.6 Check if user sent plain text requesting NSFW meme (e.g. "show nsfw", "nsfw meme", "send nsfw")
      const isPlainMemeRequest = /\b(show nsfw|nsfw meme|nsfw memes|show meme|send nsfw|send meme)\b/i.test(userMessage);
      if (isPlainMemeRequest) {
        await User.findOneAndUpdate(
          { telegramId: chatId },
          { $set: { awaitingMemeConfirmation: true } },
          { upsert: true }
        );

        const promptMsg =
          "Ahem ahem! 🔞 Pakka dekhna hai random NSFW memes? Sach batao, are you 18+ and really wish to see it? 😏\n\n💬 *Type 'yes' or 'no' in chat!*";

        const sentMsg = await ctx.reply(promptMsg, {
          parse_mode: "Markdown",
          reply_to_message_id: isGroup ? ctx.message.message_id : undefined,
        });

        await History.create({ chatId, role: "user", content: userMessage, telegramMessageId: ctx.message.message_id });
        await History.create({ chatId, role: "assistant", content: promptMsg, telegramMessageId: sentMsg.message_id });
        return;
      }

      // 2. Check for Easter Eggs or NSFW triggers
      const detectedTrigger = checkEasterEggOrNsfw(userMessage);
      if (detectedTrigger) {
        const easterEggReply = getRandomResponse();

        await triggerAlertAndNotify({
          chatId,
          userName: ctx.from?.first_name || "Friend",
          username: ctx.from?.username || "",
          type: detectedTrigger.type,
          trigger: detectedTrigger.trigger,
          text: userMessage,
        });

        const sentMsg = await ctx.reply(easterEggReply, {
          reply_to_message_id: isGroup ? ctx.message.message_id : undefined,
        });

        await History.create({
          chatId,
          role: "user",
          content: userMessage,
          telegramMessageId: ctx.message.message_id,
        });
        await History.create({
          chatId,
          role: "assistant",
          content: easterEggReply,
          telegramMessageId: sentMsg.message_id,
        });
        return;
      }

      // Fetch last 5 messages for conversation context
      const history = await History.find({ chatId })
        .sort({ createdAt: -1 })
        .limit(5);

      const historyContext = history
        .reverse()
        .map((h) => `${h.role}: ${h.content}`)
        .join("\n");

      const reply = await askAI({
        message: userMessage,
        chatId,
        historyContext,
        isGroup,
        senderName: ctx.from?.first_name || "Friend",
      });

      // Check if user explicitly asked for spoken audio / voice note
      const isVoiceRequested = /\b(speak to me|say it out loud|send (a )?voice( note)?|bol ke batao|voice me batao|audio me batao|can you speak)\b/i.test(userMessage);

      if (isVoiceRequested) {
        const { checkVoiceQuota, sendAiVoiceReply, DAILY_VOICE_LIMIT } = require("../../services/voiceService");
        const quota = await checkVoiceQuota(chatId);

        if (quota.allowed) {
          try {
            await ctx.sendChatAction("record_voice");
            const remainingTag = quota.isOwner ? "Creator Clearance" : `${quota.remaining} voice notes left today`;
            const sentVoice = await sendAiVoiceReply(bot, chatId, reply, {
              caption: `🎙️ <b>AtharvaOS Voice Note</b>\n\n<i>Voice: Matthew (AWS Polly) • ${remainingTag}</i>`,
              replyToMessageId: isGroup ? ctx.message.message_id : undefined,
            });

            await History.create({
              chatId,
              role: "user",
              content: userMessage,
              telegramMessageId: ctx.message.message_id,
            });
            return;
          } catch (voiceErr) {
            console.warn("Natural trigger voice dispatch failed, falling back to text:", voiceErr.message);
          }
        } else {
          await ctx.reply(`🎙️ <i>(Daily limit of ${DAILY_VOICE_LIMIT} AI voice notes reached. Replying in text)</i>`, { parse_mode: "HTML" });
        }
      }

      const sentMsgs = await sendTelegramHumanPaced(ctx, reply, {
        reply_to_message_id: isGroup ? ctx.message.message_id : undefined,
      });

      const firstSent = Array.isArray(sentMsgs) ? sentMsgs[0] : sentMsgs;

      // Save history with telegramMessageId for full deletion/edit support
      await History.create({
        chatId,
        role: "user",
        content: userMessage,
        telegramMessageId: ctx.message.message_id,
      });
      await History.create({
        chatId,
        role: "assistant",
        content: reply,
        telegramMessageId: firstSent?.message_id || null,
      });
    } catch (error) {
      console.error("Text handler error:", error);
      ctx.reply("Arre yaar, something went wrong on my end! 😅 Try again in a sec.");
    }
  });
};
