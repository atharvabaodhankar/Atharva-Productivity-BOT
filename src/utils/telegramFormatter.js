/**
 * Safe Telegram HTML formatter and sender.
 * Converts standard Markdown (*bold*, **bold**, _italic_, `code`, ```codeblock```, [link](url))
 * to valid Telegram HTML format with robust error fallback.
 */

function markdownToTelegramHtml(markdown) {
  if (!markdown) return "";
  let html = String(markdown)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks ```code```
  html = html.replace(/```([\s\S]*?)```/g, "<pre>$1</pre>");

  // Inline code `code`
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Double asterisk bold **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");

  // Single asterisk bold/italic *text* (common from Gemini AI)
  html = html.replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, "$1<b>$2</b>$3");

  // Underscore italic _text_
  html = html.replace(/(^|[^_])_([^_]+)_([^_]|$)/g, "$1<i>$2</i>$3");

  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');

  return html;
}

async function sendTelegramFormatted(ctx, text, extra = {}) {
  const html = markdownToTelegramHtml(text);

  try {
    return await ctx.reply(html, {
      ...extra,
      parse_mode: "HTML",
      disable_web_page_preview: false,
    });
  } catch (htmlErr) {
    // If HTML parsing fails for any reason (e.g. unclosed tag), fallback to clean plain text
    console.warn("HTML formatting failed, sending plain text fallback:", htmlErr.message);
    return await ctx.reply(text, {
      ...extra,
      disable_web_page_preview: false,
    });
  }
}

module.exports = {
  markdownToTelegramHtml,
  sendTelegramFormatted,
};
