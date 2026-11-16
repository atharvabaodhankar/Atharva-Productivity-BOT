const User = require("../../models/User");
const {
  maskApiKey,
  verifySpendWiseKey,
  executeSpendWiseTool,
  formatSpendWiseSummary,
  formatSpendWiseTransactions,
} = require("../../services/spendwiseService");
const { sendTelegramFormatted } = require("../../utils/telegramFormatter");

function buildSpendWiseMenu(user) {
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
  text += `• <code>/spendwise settings</code> — Configure balance & spend receipts\n`;
  text += `• <code>/spendwise balances [on|off]</code> — Quick toggle balances display\n`;
  text += `• <code>/spendwise monthly [on|off]</code> — Quick toggle monthly spend display\n`;
  text += `• <code>/spendwise disconnect</code> — Unlink your account\n\n`;
  text += `💬 <b>Natural AI Voice/Chat:</b>\n`;
  text += `Just talk naturally in chat to log or check anything!\n`;
  text += `• <i>"Spent ₹450 on lunch via UPI"</i>\n`;
  text += `• <i>"Log ₹1,500 grocery shopping"</i>\n`;
  text += `• <i>"What's my remaining budget?"</i>\n`;
  text += `• <i>"Who owes me money?"</i>\n\n`;
  text += `🔄 <i>To change your key, send a new key starting with <code>spw_live_</code>.</i>`;

  const inlineKeyboard = [
    [
      { text: "📊 Summary", callback_data: "spw_summary_view" },
      { text: "💳 Recent Tx", callback_data: "spw_recent_view" },
    ],
    [
      { text: "⚙️ Receipt Settings", callback_data: "spw_settings_view" },
    ],
  ];

  return { text, reply_markup: { inline_keyboard: inlineKeyboard } };
}

function buildSpendWiseSettingsMessage(user) {
  const showBalances = user?.preferences?.spendwiseShowBalances !== false;
  const showMonthly = Boolean(user?.preferences?.spendwiseShowMonthlySpend);

  let text = `⚙️ <b>SpendWise Display Settings</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `Configure what details appear when logging an expense or checking finances:\n\n`;

  text += `1. <b>Updated Balances:</b> ${showBalances ? "✅ <b>ON</b>" : "❌ <b>OFF</b>"}\n`;
  text += `   <i>Shows remaining Online (UPI) & Cash balances after each transaction.</i>\n\n`;

  text += `2. <b>Month Spending:</b> ${showMonthly ? "✅ <b>ON</b>" : "❌ <b>OFF</b>"}\n`;
  text += `   <i>Shows total money spent this month after each transaction.</i>\n\n`;

  text += `💡 <i>Tap a button below to toggle the setting instantly!</i>`;

  const inlineKeyboard = [
    [
      {
        text: showBalances ? "🌐 Balances: [ ON ]" : "🌐 Balances: [ OFF ]",
        callback_data: "toggle_spw_balances",
      },
      {
        text: showMonthly ? "📊 Month Spend: [ ON ]" : "📊 Month Spend: [ OFF ]",
        callback_data: "toggle_spw_monthly",
      },
    ],
    [
      {
        text: "💳 SpendWise Menu",
        callback_data: "spw_menu_view",
      },
    ],
  ];

  return { text, reply_markup: { inline_keyboard: inlineKeyboard } };
}

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

      // 5. Subcommand: /spendwise balances [on|off]
      if (
        subAction.toLowerCase() === "balances" ||
        subAction.toLowerCase() === "balance_display" ||
        subAction.toLowerCase() === "balance"
      ) {
        if (!user.spendwiseApiKey) {
          return sendTelegramFormatted(
            ctx,
            "⚠️ <b>SpendWise Not Connected</b>\n\nPlease connect your SpendWise key first using <code>/spendwise</code>!"
          );
        }
        const state = (parts[2] || "").toLowerCase();
        if (state === "on" || state === "true" || state === "enable" || state === "1") {
          user.preferences.spendwiseShowBalances = true;
          user.markModified("preferences");
          await user.save();
          return sendTelegramFormatted(
            ctx,
            "✅ <b>Updated Balances: ENABLED</b>\n\nYour remaining Online & Cash balances will be shown on expense receipts."
          );
        } else if (state === "off" || state === "false" || state === "disable" || state === "0") {
          user.preferences.spendwiseShowBalances = false;
          user.markModified("preferences");
          await user.save();
          return sendTelegramFormatted(
            ctx,
            "❌ <b>Updated Balances: DISABLED</b>\n\nYour wallet balances will be hidden on future receipts."
          );
        } else {
          // Toggle
          const currentStatus = user.preferences?.spendwiseShowBalances !== false;
          user.preferences.spendwiseShowBalances = !currentStatus;
          user.markModified("preferences");
          await user.save();
          return sendTelegramFormatted(
            ctx,
            `💡 <b>Updated Balances: ${!currentStatus ? "ENABLED" : "DISABLED"}</b>\n\nUse <code>/spendwise settings</code> to manage all receipt preferences.`
          );
        }
      }

      // 6. Subcommand: /spendwise monthly [on|off]
      if (
        subAction.toLowerCase() === "monthly" ||
        subAction.toLowerCase() === "month" ||
        subAction.toLowerCase() === "spend"
      ) {
        if (!user.spendwiseApiKey) {
          return sendTelegramFormatted(
            ctx,
            "⚠️ <b>SpendWise Not Connected</b>\n\nPlease connect your SpendWise key first using <code>/spendwise</code>!"
          );
        }
        const state = (parts[2] || "").toLowerCase();
        if (state === "on" || state === "true" || state === "enable" || state === "1") {
          user.preferences.spendwiseShowMonthlySpend = true;
          user.markModified("preferences");
          await user.save();
          return sendTelegramFormatted(
            ctx,
            "✅ <b>Month Spending: ENABLED</b>\n\nTotal money spent this month will be included on expense receipts."
          );
        } else if (state === "off" || state === "false" || state === "disable" || state === "0") {
          user.preferences.spendwiseShowMonthlySpend = false;
          user.markModified("preferences");
          await user.save();
          return sendTelegramFormatted(
            ctx,
            "❌ <b>Month Spending: DISABLED</b>\n\nMonthly spending totals will be hidden on future receipts."
          );
        } else {
          // Toggle
          const currentStatus = Boolean(user.preferences?.spendwiseShowMonthlySpend);
          user.preferences.spendwiseShowMonthlySpend = !currentStatus;
          user.markModified("preferences");
          await user.save();
          return sendTelegramFormatted(
            ctx,
            `📊 <b>Month Spending: ${!currentStatus ? "ENABLED" : "DISABLED"}</b>\n\nUse <code>/spendwise settings</code> to manage all receipt preferences.`
          );
        }
      }

      // 7. Subcommand: /spendwise settings
      if (
        subAction.toLowerCase() === "settings" ||
        subAction.toLowerCase() === "config" ||
        subAction.toLowerCase() === "options" ||
        subAction.toLowerCase() === "pref" ||
        subAction.toLowerCase() === "preferences"
      ) {
        if (!user.spendwiseApiKey) {
          return sendTelegramFormatted(
            ctx,
            "⚠️ <b>SpendWise Not Connected</b>\n\nPlease connect your SpendWise key first using <code>/spendwise</code> before configuring settings!"
          );
        }

        const { text, reply_markup } = buildSpendWiseSettingsMessage(user);
        return ctx.reply(text, { parse_mode: "HTML", reply_markup });
      }

      // 8. Default /spendwise menu
      if (user.spendwiseApiKey) {
        const { text, reply_markup } = buildSpendWiseMenu(user);
        return ctx.reply(text, { parse_mode: "HTML", reply_markup });
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

  // Toggle Updated Balances
  bot.action("toggle_spw_balances", async (ctx) => {
    try {
      const chatId = ctx.chat?.id || ctx.from?.id;
      const user = await User.findOne({ telegramId: chatId });
      if (!user) return ctx.answerCbQuery("User not found");

      const currentStatus = user.preferences?.spendwiseShowBalances !== false;
      const newStatus = !currentStatus;

      user.preferences.spendwiseShowBalances = newStatus;
      user.markModified("preferences");
      await user.save();

      await ctx.answerCbQuery(newStatus ? "💡 Updated Balances: ON" : "💡 Updated Balances: OFF");
      const { text, reply_markup } = buildSpendWiseSettingsMessage(user);
      try {
        await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup });
      } catch (_) {}
    } catch (err) {
      console.error("toggle_spw_balances error:", err);
      try { await ctx.answerCbQuery("Error updating setting"); } catch (_) {}
    }
  });

  // Toggle Month Spending
  bot.action("toggle_spw_monthly", async (ctx) => {
    try {
      const chatId = ctx.chat?.id || ctx.from?.id;
      const user = await User.findOne({ telegramId: chatId });
      if (!user) return ctx.answerCbQuery("User not found");

      const currentStatus = Boolean(user.preferences?.spendwiseShowMonthlySpend);
      const newStatus = !currentStatus;

      user.preferences.spendwiseShowMonthlySpend = newStatus;
      user.markModified("preferences");
      await user.save();

      await ctx.answerCbQuery(newStatus ? "📊 Month Spending: ON" : "📊 Month Spending: OFF");
      const { text, reply_markup } = buildSpendWiseSettingsMessage(user);
      try {
        await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup });
      } catch (_) {}
    } catch (err) {
      console.error("toggle_spw_monthly error:", err);
      try { await ctx.answerCbQuery("Error updating setting"); } catch (_) {}
    }
  });

  // Settings view button
  bot.action("spw_settings_view", async (ctx) => {
    try {
      const chatId = ctx.chat?.id || ctx.from?.id;
      const user = await User.findOne({ telegramId: chatId });
      if (!user) return ctx.answerCbQuery("User not found");

      await ctx.answerCbQuery();
      const { text, reply_markup } = buildSpendWiseSettingsMessage(user);
      try {
        await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup });
      } catch (_) {}
    } catch (err) {
      console.error("spw_settings_view error:", err);
      try { await ctx.answerCbQuery(); } catch (_) {}
    }
  });

  // Back to Menu view button
  bot.action("spw_menu_view", async (ctx) => {
    try {
      const chatId = ctx.chat?.id || ctx.from?.id;
      const user = await User.findOne({ telegramId: chatId });
      if (!user) return ctx.answerCbQuery("User not found");

      await ctx.answerCbQuery();
      const { text, reply_markup } = buildSpendWiseMenu(user);
      try {
        await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup });
      } catch (_) {}
    } catch (err) {
      console.error("spw_menu_view error:", err);
      try { await ctx.answerCbQuery(); } catch (_) {}
    }
  });

  // Summary button
  bot.action("spw_summary_view", async (ctx) => {
    try {
      const chatId = ctx.chat?.id || ctx.from?.id;
      const user = await User.findOne({ telegramId: chatId });
      if (!user || !user.spendwiseApiKey) return ctx.answerCbQuery("SpendWise not connected");

      await ctx.answerCbQuery("Fetching summary...");
      const summary = await executeSpendWiseTool(user.spendwiseApiKey, "get_summary", {});
      const formatted = formatSpendWiseSummary(summary);
      const reply_markup = {
        inline_keyboard: [
          [
            { text: "🔄 Refresh", callback_data: "spw_summary_view" },
            { text: "🔙 Menu", callback_data: "spw_menu_view" },
          ],
        ],
      };
      try {
        await ctx.editMessageText(formatted, { parse_mode: "HTML", reply_markup });
      } catch (_) {}
    } catch (err) {
      console.error("spw_summary_view error:", err);
      try { await ctx.answerCbQuery("Error fetching summary"); } catch (_) {}
    }
  });

  // Recent transactions button
  bot.action("spw_recent_view", async (ctx) => {
    try {
      const chatId = ctx.chat?.id || ctx.from?.id;
      const user = await User.findOne({ telegramId: chatId });
      if (!user || !user.spendwiseApiKey) return ctx.answerCbQuery("SpendWise not connected");

      await ctx.answerCbQuery("Fetching transactions...");
      const txs = await executeSpendWiseTool(user.spendwiseApiKey, "list_transactions", {
        limit: 10,
      });
      const formatted = formatSpendWiseTransactions(txs);
      const reply_markup = {
        inline_keyboard: [
          [
            { text: "🔄 Refresh", callback_data: "spw_recent_view" },
            { text: "🔙 Menu", callback_data: "spw_menu_view" },
          ],
        ],
      };
      try {
        await ctx.editMessageText(formatted, { parse_mode: "HTML", reply_markup });
      } catch (_) {}
    } catch (err) {
      console.error("spw_recent_view error:", err);
      try { await ctx.answerCbQuery("Error fetching transactions"); } catch (_) {}
    }
  });
};
