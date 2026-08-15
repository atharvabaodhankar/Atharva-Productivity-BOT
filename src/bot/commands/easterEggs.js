const {
  triggerAlertAndNotify,
  getRandomResponse,
} = require("../../utils/easterEggDetector");
const {
  requestOwnerMemeApproval,
  handleMemeApprovalAction,
} = require("../../services/memeService");
const History = require("../../models/History");
const { Markup } = require("telegraf");

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

  // 2. /show_meme (or /showmeme / /show-meme) NSFW Meme Request Flow
  bot.command(["show_meme", "showmeme", "show_memes", "nsfw_meme", "meme_nsfw"], async (ctx) => {
    try {
      const chatId = ctx.chat.id;
      const userName = ctx.from?.first_name || "Friend";
      const username = ctx.from?.username || "";
      const isGroup = ctx.chat.type === "group" || ctx.chat.type === "supergroup";

      // 1. Immediately notify owner & log alert
      await triggerAlertAndNotify({
        chatId,
        userName,
        username,
        type: "NSFW_TRIGGER",
        trigger: "/show_meme Requested",
        text: ctx.message.text || "/show_meme",
      });

      const promptText = "Ahem ahem! 🔞 Pakka dekhna hai random NSFW memes? Sach batao, are you 18+ and really wish to see it? 😏";

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback("🔥 Haan bhai pakka! (Yes)", "nsfw_meme_yes"),
          Markup.button.callback("❌ Nahi, rehne do (Cancel)", "nsfw_meme_cancel"),
        ],
      ]);

      const sentMsg = await ctx.reply(promptText, {
        ...keyboard,
        reply_to_message_id: isGroup ? ctx.message.message_id : undefined,
      });

      await History.create({
        chatId,
        role: "user",
        content: "/show_meme",
        telegramMessageId: ctx.message.message_id,
      });
      await History.create({
        chatId,
        role: "assistant",
        content: promptText,
        telegramMessageId: sentMsg.message_id,
      });
    } catch (err) {
      console.error("/show_meme error:", err);
    }
  });

  // 3. User Confirmed "YES" to NSFW Memes -> Request Owner Approval
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

      await History.create({
        chatId,
        role: "assistant",
        content: waitMsg,
        telegramMessageId: ctx.callbackQuery?.message?.message_id || null,
      });

      // Dispatch Approval Request with Preview to Atharva's Telegram
      await requestOwnerMemeApproval(bot, { chatId, userName, username });
    } catch (err) {
      console.error("nsfw_meme_yes callback error:", err);
    }
  });

  // 4. User Clicked "CANCEL"
  bot.action("nsfw_meme_cancel", async (ctx) => {
    try {
      await ctx.answerCbQuery("Cancelled");
      const cancelText = "Good boy/girl! 😇 Sharafat me hi bhalai hai. Chalo wapas focus karo apne goals aur tasks pe! 🚀✨";

      try {
        await ctx.editMessageText(cancelText);
      } catch (editErr) {
        await ctx.reply(cancelText);
      }

      await History.create({
        chatId: ctx.chat?.id || ctx.from?.id,
        role: "assistant",
        content: cancelText,
        telegramMessageId: ctx.callbackQuery?.message?.message_id || null,
      });
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
