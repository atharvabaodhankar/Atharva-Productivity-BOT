const { askAI } = require("../../ai/aiService");
const History = require("../../models/History");
const GroupConfig = require("../../models/GroupConfig");

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
      });

      // Save history asynchronously
      await History.create([
        { chatId, role: "user", content: userMessage },
        { chatId, role: "assistant", content: reply },
      ]);

      ctx.reply(reply, {
        reply_to_message_id: isGroup ? ctx.message.message_id : undefined,
      });
    } catch (error) {
      console.error("Text handler error:", error);
      ctx.reply("Arre yaar, something went wrong on my end! 😅 Try again in a sec.");
    }
  });
};
