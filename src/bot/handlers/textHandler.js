const { askAI } = require("../../ai/aiService");
const History = require("../../models/History");
const GroupConfig = require("../../models/GroupConfig");
const {
  checkEasterEggOrNsfw,
  triggerAlertAndNotify,
  getRandomResponse,
} = require("../../utils/easterEggDetector");
const { sendTelegramFormatted } = require("../../utils/telegramFormatter");

const MENTION_REGEX = /@Atharva_Produtivity_Bot|@Atharva_Productivity_Bot|@AtharvaOS/gi;

module.exports = (bot) => {
  bot.on("text", async (ctx) => {
    try {
      let userMessage = (ctx.message.text || "").trim();
      const chatId = ctx.chat.id;
      const chatType = ctx.chat.type;
      const isGroup = chatType === "group" || chatType === "supergroup";

      // 1. Group Chat Checks
      if (isGroup) {
        // Check if group is enabled by owner
        const config = await GroupConfig.findOne({ chatId });
        if (!config || !config.enabled) {
          // Bot is turned OFF in this group -> Silently ignore
          return;
        }

        const isMentioned = MENTION_REGEX.test(userMessage) || 
          ctx.message.entities?.some(
            (e) =>
              e.type === "mention" &&
              /@Atharva_Produtivity_Bot/i.test(userMessage.substring(e.offset, e.offset + e.length))
          );

        const isReplyToBot =
          ctx.message.reply_to_message?.from?.is_bot &&
          (ctx.message.reply_to_message?.from?.id === 7987805958 ||
            /@Atharva_Produtivity_Bot/i.test(ctx.message.reply_to_message?.from?.username || ""));

        // In groups, ONLY respond if explicitly tagged or replied to
        if (!isMentioned && !isReplyToBot) {
          return;
        }

        // Clean mention from prompt text
        userMessage = userMessage.replace(MENTION_REGEX, "").trim();
        if (!userMessage && !isReplyToBot) {
          return ctx.reply("Haan bhai! Kaho, kaise madad karu? 🚀", {
            reply_to_message_id: ctx.message.message_id,
          });
        }
      }

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
            "Theek hai bhai, hold tight! ⏳ Finding the spiciest meme from Reddit for you...\n\nRequest sent to Atharva for verification! Tab tak wait karo! 🌶️👀";

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

      const sentMsg = await sendTelegramFormatted(ctx, reply, {
        reply_to_message_id: isGroup ? ctx.message.message_id : undefined,
      });

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
        telegramMessageId: sentMsg.message_id,
      });
    } catch (error) {
      console.error("Text handler error:", error);
      ctx.reply("Arre yaar, something went wrong on my end! 😅 Try again in a sec.");
    }
  });
};
