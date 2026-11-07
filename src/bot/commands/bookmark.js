const { saveBookmark, getBookmarks, deleteMemory } = require("../../services/memoryService");
const { privateOnly } = require("../middlewares/privateOnly");
const { sendTelegramFormatted } = require("../../utils/telegramFormatter");
const Memory = require("../../models/Memory");
const mongoose = require("mongoose");

/**
 * Extracts URL and optional title from raw input text
 */
function extractUrlAndTitle(rawText) {
  if (!rawText) return { url: null, title: "" };

  // Strip leading command prefixes if present (e.g. "bookmark", "/bookmark", "save link")
  let cleanInput = rawText.replace(/^\s*(?:\/bookmark|bookmark|save\s+bookmark|save\s+link|link)[:\s]*/i, "").trim();

  // 1. Look for explicit quoted URL or standard web URL
  const urlRegex = /["']?(https?:\/\/[^\s"'<>]+|www\.[^\s"'<>]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s"'<>]*)?)["']?/i;
  const match = cleanInput.match(urlRegex);
  if (!match) {
    return { url: null, title: "" };
  }

  let matchedUrl = match[1];
  if (!/^https?:\/\//i.test(matchedUrl)) {
    matchedUrl = `https://${matchedUrl}`;
  }

  // 2. Remove the matched URL from the input to extract title
  const remaining = cleanInput.replace(match[0], "").trim();
  const cleanTitle = remaining.replace(/^["'“”]+|["'“”]+$/gu, "").trim();

  return {
    url: matchedUrl,
    title: cleanTitle,
  };
}

module.exports = (bot) => {
  // Command: /bookmark and /bookmarks
  bot.command(["bookmark", "bookmarks", "links"], privateOnly(async (ctx) => {
    const rawText = (ctx.message.text || "").trim();
    const parts = rawText.split(/\s+/);
    const command = parts[0].toLowerCase();
    const argsText = parts.slice(1).join(" ").trim();
    const chatId = ctx.chat.id;

    // 1. If user typed /bookmarks or /bookmark list -> Display saved bookmarks
    if (command.includes("bookmarks") || command.includes("links") || argsText === "list") {
      const bookmarks = await getBookmarks(chatId);

      if (bookmarks.length === 0) {
        return ctx.reply(
          "ℹ️ <b>You have no saved bookmarks yet!</b>\n\n" +
          "Save any link by sending:\n" +
          "• <code>/bookmark https://example.com [Title]</code>\n" +
          "• <code>bookmark \"https://...\"</code>\n" +
          "• Or reply to any message containing a link with <code>/bookmark</code>!",
          { parse_mode: "HTML" }
        );
      }

      let message = `🔖 <b>Your Saved Bookmarks (${bookmarks.length}):</b>\n`;
      message += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

      const inlineKeyboard = [];

      bookmarks.slice(0, 15).forEach((bm, i) => {
        const title = bm.content || "Bookmark";
        const link = bm.url || "#";
        const dateStr = bm.createdAt ? new Date(bm.createdAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", month: "short", day: "numeric" }) : "";
        const dateTag = dateStr ? ` <i>(${dateStr})</i>` : "";

        message += `<b>${i + 1}. ${title}</b>${dateTag}\n`;
        message += `   🔗 <a href="${link}">${link}</a>\n\n`;

        // Add 1-tap delete buttons for top bookmarks
        if (i < 5) {
          const snippet = title.length > 18 ? `${title.slice(0, 18)}…` : title;
          inlineKeyboard.push([
            {
              text: `🗑️ Delete #${i + 1}: ${snippet}`,
              callback_data: `del_bm_${bm._id}`,
            },
          ]);
        }
      });

      if (bookmarks.length > 15) {
        message += `<i>...and ${bookmarks.length - 15} more bookmarks.</i>\n`;
      }

      return ctx.reply(message, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: inlineKeyboard.length > 0 ? { inline_keyboard: inlineKeyboard } : undefined,
      });
    }

    // 2. Check if user replied to a message containing a link with /bookmark
    let textToParse = argsText;
    const repliedText = ctx.message?.reply_to_message?.text || ctx.message?.reply_to_message?.caption || "";
    if (!textToParse && repliedText) {
      textToParse = repliedText;
    }

    // 3. If no URL argument provided, show usage guide
    if (!textToParse) {
      return ctx.reply(
        "🔖 <b>Bookmark Links Instantly:</b>\n" +
        "━━━━━━━━━━━━━━━━━━━━━\n" +
        "Save any link, video, article, or resource directly to your personal second brain:\n\n" +
        "📌 <b>Usage:</b>\n" +
        "• <code>/bookmark https://github.com/my-repo My Project</code>\n" +
        "• <code>bookmark \"https://example.com\" \"My Cool Link\"</code>\n" +
        "• <code>bookmark https://youtube.com/watch?v=...</code>\n" +
        "• Or reply to any link in chat with <code>/bookmark</code>!\n\n" +
        "📋 View all saved links anytime with <code>/bookmarks</code>.",
        { parse_mode: "HTML" }
      );
    }

    // 4. Extract URL and Title
    const { url, title } = extractUrlAndTitle(textToParse);
    if (!url) {
      return ctx.reply(
        "❌ <b>No valid link detected!</b>\n\nPlease provide a valid URL, e.g.:\n<code>/bookmark https://example.com My Title</code>",
        { parse_mode: "HTML" }
      );
    }

    try {
      const savedDoc = await saveBookmark({
        chatId,
        url,
        title,
      });

      const confirmMsg =
        `🔖 <b>Bookmark Saved!</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `📌 <b>Title:</b> ${savedDoc.content}\n` +
        `🔗 <b>Link:</b> <a href="${savedDoc.url}">${savedDoc.url}</a>\n\n` +
        `💡 <i>View all your bookmarks anytime with /bookmarks!</i>`;

      const inlineKeyboard = [
        [
          { text: "🌐 Open Link", url: savedDoc.url },
          { text: "🗑️ Delete", callback_data: `del_bm_${savedDoc._id}` },
        ],
      ];

      return ctx.reply(confirmMsg, {
        parse_mode: "HTML",
        disable_web_page_preview: false,
        reply_markup: { inline_keyboard: inlineKeyboard },
      });
    } catch (err) {
      console.error("Failed to save bookmark:", err);
      return ctx.reply(`❌ Could not save bookmark: ${err.message}`);
    }
  }));

  // Handle 1-tap delete callback for bookmarks
  bot.action(/^del_bm_(.+)$/, async (ctx) => {
    try {
      const bmId = ctx.match[1];
      const chatId = ctx.chat?.id || ctx.from?.id;

      if (!mongoose.Types.ObjectId.isValid(bmId)) {
        return ctx.answerCbQuery("Invalid bookmark ID.");
      }

      const deleted = await Memory.findOneAndDelete({ _id: bmId, chatId });
      if (deleted) {
        await ctx.answerCbQuery(`🗑️ Deleted: "${deleted.content}"`);
        try {
          await ctx.editMessageText(
            `🗑️ <b>Bookmark Deleted:</b> <s>${deleted.content}</s>`,
            { parse_mode: "HTML" }
          );
        } catch (_) {
          await ctx.reply(`🗑️ Deleted bookmark: "${deleted.content}"`);
        }
      } else {
        await ctx.answerCbQuery("Bookmark not found or already deleted.");
      }
    } catch (err) {
      console.error("del_bm error:", err);
      try {
        await ctx.answerCbQuery("Error deleting bookmark.");
      } catch (_) {}
    }
  });
};

module.exports.extractUrlAndTitle = extractUrlAndTitle;
