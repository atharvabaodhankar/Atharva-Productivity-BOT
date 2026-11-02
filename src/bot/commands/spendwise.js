const User = require("../../models/User");
const {
  maskApiKey,
  verifySpendWiseKey,
  executeSpendWiseTool,
  formatSpendWiseSummary,
  formatSpendWiseTransactions,
} = require("../../services/spendwiseService");
const { sendTelegramFormatted } = require("../../utils/telegramFormatter");

module.exports = (bot) => {
  bot.command(["spendwise", "expense", "expenses"], async (ctx) => {
    try {
      const chatId = ctx.chat.id;
      const isGroup = ctx.chat.type === "group" || ctx.chat.type === "supergroup";
      const rawText = (ctx.message?.text || "").trim();
      const parts = rawText.split(/\s+/);
      const subAction = parts[1] ? parts[1].trim() : "";

      // Strict Group Chat Privacy: Remind user to use private DM for financial data
      if (isGroup) {
        return ctx.reply(
          "🔒 <b>SpendWise Financial Privacy:</b>\n" +
            "Expense tracking and wallet balances contain sensitive financial data! Please DM me directly @Atharva_Produtivity_Bot to manage your SpendWise wallet safely. 😊",
          { parse_mode: "HTML", reply_to_message_id: ctx.message.message_id }
        );
      }

      let user = await User.findOne({ telegramId: chatId });
      if (!user) {
        user = await User.create({
          telegramId: chatId,
          firstName: ctx.from?.first_name || "Friend",
          username: ctx.from?.username || "",
        });
      }

      // 1. Direct key passed: /spendwise spw_live_...
      if (subAction && subAction.startsWith("spw_live_")) {
        await ctx.sendChatAction("typing").catch(() => {});
        const verifyResult = await verifySpendWiseKey(subAction);

        if (!verifyResult.valid) {
          return sendTelegramFormatted(
            ctx,
            `❌ <b>SpendWise Connection Failed:</b>\n\n${verifyResult.message}\n\nPlease check your key in SpendWise Dashboard -> Settings -> API Keys & MCP.`
          );
        }

        user.spendwiseApiKey = subAction.trim();
        user.spendwiseConnectedAt = new Date();
        user.awaitingSpendwiseKey = false;
        await user.save();

        let replyText = `🎉 <b>SpendWise Connected Successfully!</b>\n`;
        replyText += `━━━━━━━━━━━━━━━━━━━━━\n`;
        replyText += `🔑 <b>Linked Key:</b> <code>${maskApiKey(subAction)}</code>\n\n`;

        if (verifyResult.summary) {
          replyText += formatSpendWiseSummary(verifyResult.summary);
        } else {
          replyText += `Your SpendWise wallet is now integrated with AtharvaOS!\n\n`;
          replyText += `💬 <b>Natural Language Commands:</b>\n`;
          replyText += `• <i>"Spent ₹250 on Starbucks via UPI"</i>\n`;
          replyText += `• <i>"Added ₹5,000 freelance income to cash"</i>\n`;
          replyText += `• <i>"What is my current balance?"</i>\n`;
          replyText += `• <i>"Show my last 5 transactions"</i>\n`;
          replyText += `• <i>"Split ₹1,200 dinner bill with rahul@gmail.com"</i>\n`;
        }

        return sendTelegramFormatted(ctx, replyText);
      }

      // 2. Subcommand: /spendwise disconnect
      if (subAction.toLowerCase() === "disconnect" || subAction.toLowerCase() === "unlink") {
        if (!user.spendwiseApiKey) {
          return sendTelegramFormatted(ctx, "ℹ️ You do not have an active SpendWise connection.");
        }

        user.spendwiseApiKey = "";
        user.spendwiseConnectedAt = null;
        user.awaitingSpendwiseKey = false;
        await user.save();

        return sendTelegramFormatted(
          ctx,
          "🔌 <b>SpendWise Disconnected:</b>\n\nYour SpendWise API key has been securely removed. You can reconnect anytime with <code>/spendwise</code>."
        );
      }

      // 3. Subcommand: /spendwise summary
      if (
        subAction.toLowerCase() === "summary" ||
        subAction.toLowerCase() === "balance" ||
        subAction.toLowerCase() === "status"
      ) {
        if (!user.spendwiseApiKey) {
          return sendTelegramFormatted(
            ctx,
            "⚠️ <b>SpendWise Not Connected</b>\n\nPlease connect your SpendWise key first using <code>/spendwise</code>!"
          );
        }

        await ctx.sendChatAction("typing").catch(() => {});
        try {
          const summary = await executeSpendWiseTool(user.spendwiseApiKey, "get_summary", {});
          const formatted = formatSpendWiseSummary(summary);
          return sendTelegramFormatted(ctx, formatted);
        } catch (err) {
          return sendTelegramFormatted(
            ctx,
            `❌ <b>Failed to fetch SpendWise summary:</b>\n${err.message}\n\nMake sure your key is active in SpendWise.`
          );
        }
      }

      // 4. Subcommand: /spendwise transactions
      if (
        subAction.toLowerCase() === "transactions" ||
        subAction.toLowerCase() === "tx" ||
        subAction.toLowerCase() === "recent"
      ) {
        if (!user.spendwiseApiKey) {
          return sendTelegramFormatted(
            ctx,
            "⚠️ <b>SpendWise Not Connected</b>\n\nPlease connect your SpendWise key first using <code>/spendwise</code>!"
          );
        }

        await ctx.sendChatAction("typing").catch(() => {});
        try {
          const txs = await executeSpendWiseTool(user.spendwiseApiKey, "list_transactions", {
            limit: 10,
          });
          const formatted = formatSpendWiseTransactions(txs);
          return sendTelegramFormatted(ctx, formatted);
        } catch (err) {
          return sendTelegramFormatted(
            ctx,
            `❌ <b>Failed to fetch transactions:</b>\n${err.message}`
          );
        }
      }

      // 5. Default /spendwise menu
      if (user.spendwiseApiKey) {
        // User already connected
        let text = `💳 <b>SpendWise Expense Tracker</b>\n`;
        text += `━━━━━━━━━━━━━━━━━━━━━\n`;
        text += `Status: 🟢 <b>Connected & Active</b>\n`;
        text += `Linked Key: <code>${maskApiKey(user.spendwiseApiKey)}</code>\n`;
        if (user.spendwiseConnectedAt) {
          text += `Connected: <code>${new Date(user.spendwiseConnectedAt).toLocaleDateString("en-IN")}</code>\n`;
        }
        text += `\n<b>Quick Commands:</b>\n`;
        text += `• <code>/spendwise summary</code> — Check balances & monthly budget\n`;
        text += `• <code>/spendwise transactions</code> — View recent 10 transactions\n`;
        text += `• <code>/spendwise disconnect</code> — Unlink your account\n\n`;
        text += `💬 <b>Natural AI Voice/Chat:</b>\n`;
        text += `Just talk naturally in chat to log or check anything!\n`;
        text += `• <i>"Spent ₹450 on lunch via UPI"</i>\n`;
        text += `• <i>"Log ₹1,500 grocery shopping"</i>\n`;
        text += `• <i>"What's my remaining budget?"</i>\n`;
        text += `• <i>"Who owes me money?"</i>\n\n`;
        text += `🔄 <i>To change your key, send a new key starting with <code>spw_live_</code>.</i>`;

        return sendTelegramFormatted(ctx, text);
      }

      // User NOT connected yet -> prompt them for the key!
      user.awaitingSpendwiseKey = true;
      await user.save();

      let promptText = `💳 <b>Connect SpendWise AI Expense Tracker</b>\n`;
      promptText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      promptText += `Track your expenses, manage UPI & Cash balances, split bills, and monitor your monthly budget directly from AtharvaOS!\n\n`;
      promptText += `🔑 <b>How to get your API Key:</b>\n`;
      promptText += `1. Open SpendWise: <a href="https://spend-wise-money.vercel.app">https://spend-wise-money.vercel.app</a>\n`;
      promptText += `2. Click the <b>Key icon (🔑)</b> in the top header (or go to <b>Settings → API Keys & MCP</b>)\n`;
      promptText += `3. Click <b>"Create Secret Key"</b> and copy your <code>spw_live_...</code> key\n\n`;
      promptText += `👉 <b>Paste and send your key here in chat</b> to connect instantly!`;

      return sendTelegramFormatted(ctx, promptText);
    } catch (err) {
      console.error("SpendWise command error:", err);
      return ctx.reply("Arre yaar, something went wrong with SpendWise! 😅 Try again in a moment.");
    }
  });
};
