const { askAI } = require("../../ai/aiService");
const History = require("../../models/History");
const GroupConfig = require("../../models/GroupConfig");
const { sendTelegramHumanPaced } = require("../../utils/telegramFormatter");

module.exports = (bot) => {
  bot.command(["ask", "ai", "chat", "q"], async (ctx) => {
    try {
      const chatId = ctx.chat.id;
      const isGroup = ctx.chat.type === "group" || ctx.chat.type === "supergroup";

      if (isGroup) {
        const config = await GroupConfig.findOne({ chatId });
        if (config && config.enabled === false) {
          return;
        }
      }

      // Extract query after command
      const text = ctx.message.text || "";
      const match = text.match(/^\/(?:ask|ai|chat|q)(?:@\w+)?\s*(.*)$/is);
      const query = (match && match[1]) ? match[1].trim() : "";

      if (!query) {
        return ctx.reply("Haan bhai! Kya poochna hai? Example: /ask kya haal hai?", {
          reply_to_message_id: ctx.message.message_id,
        });
      }

      const history = await History.find({ chatId })
        .sort({ createdAt: -1 })
        .limit(5);

      const historyContext = history
        .reverse()
        .map((h) => `${h.role}: ${h.content}`)
        .join("\n");

      const reply = await askAI({
        message: query,
        chatId,
        historyContext,
        isGroup,
        senderName: ctx.from?.first_name || "Friend",
      });

      const sentMsgs = await sendTelegramHumanPaced(ctx, reply, {
        reply_to_message_id: isGroup ? ctx.message.message_id : undefined,
      });

      const firstSent = Array.isArray(sentMsgs) ? sentMsgs[0] : sentMsgs;

      await History.create({
        chatId,
        role: "user",
        content: query,
        telegramMessageId: ctx.message.message_id,
      });
      await History.create({
        chatId,
        role: "assistant",
        content: reply,
        telegramMessageId: firstSent?.message_id || null,
      });
    } catch (err) {
      console.error("/ask command error:", err);
      ctx.reply("Arre yaar, something went wrong! 😅 Try again in a sec.");
    }
  });
};
