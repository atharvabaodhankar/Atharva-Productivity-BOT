const {
  triggerAlertAndNotify,
  getRandomResponse,
  SFW_REFUSAL_MESSAGE,
} = require("../../utils/easterEggDetector");
const History = require("../../models/History");

module.exports = (bot) => {
  const easterEggCommands = [
    "secret",
    "easteregg",
    "eastereggs",
    "hack",
  ];

  const disabledNsfwCommands = [
    "show_meme",
    "showmeme",
    "show_memes",
    "nsfw",
    "show_nsfw",
    "nsfw_meme",
    "meme_nsfw",
    "show_nsfw_meme",
    "carcasting",
    "xxx",
    "video_meme",
    "videomeme",
  ];

  // 1. Secret & Easter Egg Discovery Commands (100% SFW)
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
        type: "EASTER_EGG",
        trigger: commandText,
        text: commandText,
      });

      const sentMsg = await ctx.reply(replyText, {
        parse_mode: "Markdown",
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

  // 2. Disabled NSFW / Meme Commands -> Polite SFW Refusal
  bot.command(disabledNsfwCommands, async (ctx) => {
    try {
      const isGroup = ctx.chat.type === "group" || ctx.chat.type === "supergroup";
      await ctx.reply(
        "⚠️ <b>AtharvaOS is a 100% SFW productivity copilot.</b>\n\nAdult, explicit, or NSFW features are permanently disabled. Let's stay focused on your goals, tasks, and schedule! 🚀✨",
        {
          parse_mode: "HTML",
          reply_to_message_id: isGroup ? ctx.message.message_id : undefined,
        }
      );
    } catch (err) {
      console.error("Disabled NSFW command notice error:", err);
    }
  });
};
