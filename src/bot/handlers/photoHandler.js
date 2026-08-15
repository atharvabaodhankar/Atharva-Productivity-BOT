const { askAI } = require("../../ai/aiService");
const History = require("../../models/History");
const GroupConfig = require("../../models/GroupConfig");

module.exports = (bot) => {
  bot.on("photo", async (ctx) => {
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

        const botUsername = ctx.botInfo?.username || "Atharva_Productivity_Bot";
        const botMentionRegex = new RegExp(`@${botUsername}`, "i");
        const isMentioned = botMentionRegex.test(caption);
        const isReplyToBot =
          ctx.message.reply_to_message?.from?.is_bot &&
          (ctx.message.reply_to_message?.from?.username?.toLowerCase() === botUsername.toLowerCase() ||
            ctx.message.reply_to_message?.from?.id === ctx.botInfo?.id);

        if (!isMentioned && !isReplyToBot) {
          return;
        }

        caption = caption.replace(botMentionRegex, "").trim();
      }

      // Pick highest resolution photo
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const fileId = photo.file_id;

      ctx.reply("Reading your image with Vision... 🔎👀", {
        reply_to_message_id: isGroup ? ctx.message.message_id : undefined,
      });

      const fileLink = await ctx.telegram.getFileLink(fileId);
      const response = await fetch(fileLink.href);
      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const base64ImageUrl = `data:image/jpeg;base64,${base64}`;

      const history = await History.find({ chatId })
        .sort({ createdAt: -1 })
        .limit(5);

      const historyContext = history
        .reverse()
        .map((h) => `${h.role}: ${h.content}`)
        .join("\n");

      const reply = await askAI({
        message: caption,
        chatId,
        historyContext,
        base64ImageUrl,
      });

      await History.create([
        { chatId, role: "user", content: caption ? `[Photo] ${caption}` : "[Photo]" },
        { chatId, role: "assistant", content: reply },
      ]);

      ctx.reply(reply, {
        reply_to_message_id: isGroup ? ctx.message.message_id : undefined,
      });
    } catch (error) {
      console.error("Photo handler error:", error);
      ctx.reply("Arre yaar, I couldn't process that image! 😅 Make sure it's under 10MB.");
    }
  });
};
