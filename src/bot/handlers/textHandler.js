const { askAI } = require("../../ai/aiService");
const History = require("../../models/History");

module.exports = (bot) => {
  bot.on("text", async (ctx) => {
    try {
      const userMessage = ctx.message.text;
      const chatId = ctx.chat.id;

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

      ctx.reply(reply);
    } catch (error) {
      console.error("Text handler error:", error);
      ctx.reply("Arre yaar, something went wrong on my end! 😅 Try again in a sec.");
    }
  });
};
