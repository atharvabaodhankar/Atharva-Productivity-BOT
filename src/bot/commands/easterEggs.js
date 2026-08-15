const {
  triggerAlertAndNotify,
  getRandomResponse,
} = require("../../utils/easterEggDetector");
const {
  requestOwnerMemeApproval,
  handleMemeApprovalAction,
} = require("../../services/memeService");
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

  // 1. Secret & Easter Egg Discovery Commands
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
        type:
          commandText.includes("nsfw") || commandText.includes("carcasting") || commandText.includes("xxx")
            ? "NSFW_TRIGGER"
            : "EASTER_EGG",
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

  // 2. /show_meme (ask 18+ confirmation and wait for user to type 'yes' or 'no' in chat)
  bot.command(["show_meme", "showmeme", "show_memes", "nsfw_meme", "meme_nsfw"], async (ctx) => {
    try {
      const chatId = ctx.chat.id;
      const userName = ctx.from?.first_name || "Friend";
      const username = ctx.from?.username || "";
      const isGroup = ctx.chat.type === "group" || ctx.chat.type === "supergroup";

      const User = require("../../models/User");
      await User.findOneAndUpdate(
        { telegramId: chatId },
        {
          $set: {
            telegramId: chatId,
            firstName: userName,
            username,
            awaitingMemeConfirmation: true,
          },
        },
        { upsert: true, new: true }
      );

      // 1. Log alert in DB & notify Admin Console
      await triggerAlertAndNotify({
        chatId,
        userName,
        username,
        type: "NSFW_TRIGGER",
        trigger: "/show_meme Requested",
        text: ctx.message.text || "/show_meme",
      });

      const promptMsg =
        "Ahem ahem! 🔞 Pakka dekhna hai random NSFW memes? Sach batao, are you 18+ and really wish to see it? 😏\n\n💬 *Type 'yes' or 'no' in chat!*";

      const sentMsg = await ctx.reply(promptMsg, {
        parse_mode: "Markdown",
        reply_to_message_id: isGroup ? ctx.message.message_id : undefined,
      });

      await History.create({
        chatId,
        role: "user",
        content: ctx.message.text || "/show_meme",
        telegramMessageId: ctx.message.message_id,
      });
      await History.create({
        chatId,
        role: "assistant",
        content: promptMsg,
        telegramMessageId: sentMsg.message_id,
      });
    } catch (err) {
      console.error("/show_meme error:", err);
      try {
        await ctx.reply("Arre yaar, meme request me problem aayi! Try again in a second. 😅");
      } catch (e) {}
    }
  });

  // 3. Backward Compatibility: User Clicked legacy "YES"
  bot.action("nsfw_meme_yes", async (ctx) => {
    try {
      await ctx.answerCbQuery("Request received! Asking Atharva for approval... ⏳");
      const chatId = ctx.chat?.id || ctx.from?.id;
      const userName = ctx.from?.first_name || "Friend";
      const username = ctx.from?.username || "";

      const waitMsg =
        "Theek hai bhai, hold tight! ⏳ Finding the spiciest meme from Reddit for you...\n\nRequest sent to Atharva for verification! Tab tak wait karo! 🌶️👀";

      try {
        await ctx.editMessageText(waitMsg);
      } catch (editErr) {
        await ctx.reply(waitMsg);
      }

      await requestOwnerMemeApproval(bot, { chatId, userName, username });
    } catch (err) {
      console.error("nsfw_meme_yes callback error:", err);
    }
  });

  // 4. Backward Compatibility: User Clicked legacy "CANCEL"
  bot.action("nsfw_meme_cancel", async (ctx) => {
    try {
      await ctx.answerCbQuery("Cancelled");
      const cancelText = "Good boy/girl! 😇 Sharafat me hi bhalai hai. Chalo wapas focus karo apne goals aur tasks pe! 🚀✨";

      try {
        await ctx.editMessageText(cancelText);
      } catch (editErr) {
        await ctx.reply(cancelText);
      }
    } catch (err) {
      console.error("nsfw_meme_cancel callback error:", err);
    }
  });

  // 5. Owner Telegram Callback: Approve Meme
  bot.action(/^meme_appr_(.+)$/, async (ctx) => {
    try {
      const requestId = ctx.match[1];
      await handleMemeApprovalAction(bot, ctx, requestId, true);
    } catch (err) {
      console.error("meme_appr error:", err);
    }
  });

  // 6. Owner Telegram Callback: Reject Meme
  bot.action(/^meme_rejc_(.+)$/, async (ctx) => {
    try {
      const requestId = ctx.match[1];
      await handleMemeApprovalAction(bot, ctx, requestId, false);
    } catch (err) {
      console.error("meme_rejc error:", err);
    }
  });
};
