const {
  triggerAlertAndNotify,
  getRandomResponse,
} = require("../../utils/easterEggDetector");
const History = require("../../models/History");

module.exports = (bot) => {
  const easterEggCommands = [
    "secret",
    "memes",
    "nsfw",
    "carcasting",
    "easteregg",
    "eastereggs",
    "hack",
    "xxx",
  ];

  bot.command(easterEggCommands, async (ctx) => {
    try {
      const chatId = ctx.chat.id;
      const commandText = ctx.message.text;
      const userName = ctx.from?.first_name || "Friend";
      const username = ctx.from?.username || "";
      const isGroup = ctx.chat.type === "group" || ctx.chat.type === "supergroup";

      const replyText = getRandomResponse();

      // Trigger owner alert & save to MongoDB
      await triggerAlertAndNotify({
        chatId,
        userName,
        username,
        type: commandText.includes("nsfw") || commandText.includes("carcasting") || commandText.includes("xxx")
          ? "NSFW_TRIGGER"
          : "EASTER_EGG",
        trigger: commandText,
        text: commandText,
      });

      const sentMsg = await ctx.reply(replyText, {
        reply_to_message_id: isGroup ? ctx.message.message_id : undefined,
      });

      // Save to history
      await History.create({
        chatId,
        role: "user",
        content: commandText,
        telegramMessageId: ctx.message.message_id,
      });
      await History.create({
        chatId,
        role: "assistant",
        content: replyText,
        telegramMessageId: sentMsg.message_id,
      });
    } catch (err) {
      console.error("Easter egg command error:", err);
    }
  });
};
