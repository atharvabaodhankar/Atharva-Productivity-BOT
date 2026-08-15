const { askAI } = require("../../ai/aiService");
const History = require("../../models/History");

module.exports = (bot) => {
  bot.on("photo", async (ctx) => {
    try {
      const chatId = ctx.chat.id;
      const caption = ctx.message.caption || "";

      // Pick highest resolution photo
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const fileId = photo.file_id;

      ctx.reply("Reading your image with Vision... 🔎👀");

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

      ctx.reply(reply);
    } catch (error) {
      console.error("Photo handler error:", error);
      ctx.reply("Arre yaar, I couldn't process that image! 😅 Make sure it's under 10MB.");
    }
  });
};
