/**
 * SpendWise Model Context Protocol (MCP) Integration Service
 * Connects AtharvaOS to SpendWise API: https://spend-wise-money.vercel.app/api/mcp
 */

const SPENDWISE_MCP_ENDPOINT =
  process.env.SPENDWISE_MCP_URL || "https://spend-wise-money.vercel.app/api/mcp";

/**
 * Masks an API key for safe user display
 * e.g. "spw_live_68fcc5bf72baf6e87af25afd751e3cc1087dc1d1cd3f6667" -> "spw_live_68fc••••••••6667"
 */
function maskApiKey(key) {
  if (!key || typeof key !== "string") return "";
  const clean = key.trim();
  if (clean.length < 16) return clean;
  const prefix = clean.slice(0, 13);
  const suffix = clean.slice(-4);
  return `${prefix}••••••••${suffix}`;
}

/**
 * Executes a JSON-RPC 2.0 MCP request against SpendWise API
 */
async function callSpendWiseMcp(apiKey, method, params = {}) {
  if (!apiKey || !apiKey.startsWith("spw_live_")) {
    throw new Error("Invalid or missing SpendWise API key. Keys must start with 'spw_live_'.");
  }

  const response = await fetch(SPENDWISE_MCP_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let parsedMsg = errorText;
    try {
      const errJson = JSON.parse(errorText);
      parsedMsg = errJson.error?.message || errJson.message || errorText;
    } catch (_) {}
    throw new Error(`SpendWise MCP HTTP ${response.status}: ${parsedMsg}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || JSON.stringify(data.error));
  }

  return data.result;
}

/**
 * Validates a user's SpendWise API key format and tests connectivity.
 * @param {string} apiKey
 * @returns {Promise<{ valid: boolean, message: string, summary?: Object }>}
 */
async function verifySpendWiseKey(apiKey) {
  if (!apiKey || typeof apiKey !== "string") {
    return { valid: false, message: "Please provide a valid SpendWise API key." };
  }

  const cleanKey = apiKey.trim();
  if (!cleanKey.startsWith("spw_live_") || cleanKey.length < 24) {
    return {
      valid: false,
      message: "Invalid API key format. SpendWise keys must start with 'spw_live_' (e.g. spw_live_68fc...).",
    };
  }

  try {
    // Try get_summary tool call to verify authentication
    const result = await executeSpendWiseTool(cleanKey, "get_summary", {});
    return {
      valid: true,
      message: "SpendWise connected successfully!",
      summary: result,
    };
  } catch (err) {
    const errMsg = err.message || "";
    // If unauthorized (-32001) or invalid key
    if (errMsg.includes("Unauthorized") || errMsg.includes("-32001") || errMsg.includes("Invalid")) {
      return {
        valid: false,
        message: "API key was rejected by SpendWise. Please verify your secret key in SpendWise Settings → API Keys & MCP.",
      };
    }

    // If server error on Vercel (e.g. default credentials / Firebase setup), accept format with notice
    return {
      valid: true,
      message: "SpendWise key saved. Note: SpendWise backend returned a server notice: " + errMsg,
    };
  }
}

/**
 * Executes a named SpendWise MCP tool
 * Available tools:
 * - add_transaction: { amount, type, category, paymentMethod, description, date, affectCurrentBalance }
 * - get_summary: {}
 * - list_transactions: { limit, category, type, search }
 * - split_expense: { totalAmount, description, friendEmails, paymentMethod, category, date }
 * - get_debts: { filter }
 * - settle_debt: { debtId, action }
 */
async function executeSpendWiseTool(apiKey, toolName, toolArgs = {}) {
  const result = await callSpendWiseMcp(apiKey, "tools/call", {
    name: toolName,
    arguments: toolArgs,
  });

  // Extract MCP text content from result
  if (result?.content && Array.isArray(result.content)) {
    const textItem = result.content.find((c) => c.type === "text");
    if (textItem && textItem.text) {
      try {
        return JSON.parse(textItem.text);
      } catch (_) {
        return textItem.text;
      }
    }
  }

  return result;
}

/**
 * Formats get_summary output into a clean Telegram HTML message
 */
function formatSpendWiseSummary(summaryData) {
  if (!summaryData) return "No summary data returned from SpendWise.";

  // Handle if summaryData is a string or parsed object
  const data = typeof summaryData === "string" ? { raw: summaryData } : summaryData;

  const online = data.onlineBalance ?? data.currentOnlineBalance ?? data.online ?? null;
  const cash = data.cashBalance ?? data.currentCashBalance ?? data.cash ?? null;
  const monthly = data.monthlySpend ?? data.currentMonthSpending ?? data.monthlySpent ?? null;
  const budget = data.budget ?? data.monthlyBudget ?? null;

  let text = `💳 <b>SpendWise Financial Summary</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (online !== null) {
    text += `🌐 <b>Online Balance (UPI/Bank):</b> ₹${Number(online).toLocaleString("en-IN")}\n`;
  }
  if (cash !== null) {
    text += `💵 <b>Cash Balance:</b> ₹${Number(cash).toLocaleString("en-IN")}\n`;
  }

  if (online !== null && cash !== null) {
    const total = Number(online) + Number(cash);
    text += `💰 <b>Total Net Balance:</b> ₹${total.toLocaleString("en-IN")}\n`;
  }

  text += `\n`;

  if (monthly !== null) {
    text += `📊 <b>This Month's Spending:</b> ₹${Number(monthly).toLocaleString("en-IN")}\n`;
  }
  if (budget !== null) {
    text += `🎯 <b>Monthly Budget:</b> ₹${Number(budget).toLocaleString("en-IN")}\n`;
    if (monthly !== null && budget > 0) {
      const pct = Math.min(100, Math.round((monthly / budget) * 100));
      const barFilled = Math.round(pct / 10);
      const bar = "█".repeat(barFilled) + "░".repeat(10 - barFilled);
      text += `📈 <b>Progress:</b> [${bar}] ${pct}%\n`;
    }
  }

  if (data.raw) {
    text += `\n<i>${data.raw}</i>\n`;
  }

  text += `\n💡 <i>To log an expense, just say: "Spent ₹250 on lunch via UPI"</i>`;
  return text;
}

/**
 * Formats list_transactions output into a clean Telegram HTML message
 */
function formatSpendWiseTransactions(transactions) {
  if (!transactions) return "No transactions found.";

  const list = Array.isArray(transactions)
    ? transactions
    : (transactions.transactions || transactions.items || []);

  if (list.length === 0) {
    return "💳 <b>SpendWise Transactions</b>\n\nNo transactions found matching your criteria.";
  }

  let text = `💳 <b>Recent SpendWise Transactions (${list.length})</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  list.forEach((t, i) => {
    const isIncome = t.type === "income";
    const sign = isIncome ? "+" : "-";
    const emoji = isIncome ? "🟢" : "🔴";
    const amountStr = `₹${Number(t.amount || 0).toLocaleString("en-IN")}`;
    const dateStr = t.date || (t.createdAt ? new Date(t.createdAt).toLocaleDateString("en-IN") : "");
    const methodStr = t.paymentMethod ? ` [${t.paymentMethod.toUpperCase()}]` : "";
    const categoryStr = t.category ? ` • <i>${t.category}</i>` : "";
    const descStr = t.description ? `\n   └─ "${t.description}"` : "";

    text += `${i + 1}. ${emoji} <b>${sign}${amountStr}</b>${categoryStr}${methodStr} (<code>${dateStr}</code>)${descStr}\n`;
  });

  return text;
}

module.exports = {
  SPENDWISE_MCP_ENDPOINT,
  maskApiKey,
  callSpendWiseMcp,
  verifySpendWiseKey,
  executeSpendWiseTool,
  formatSpendWiseSummary,
  formatSpendWiseTransactions,
};
