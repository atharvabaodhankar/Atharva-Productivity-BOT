/**
 * Safe Telegram HTML formatter and Human-Paced Multi-Bubble Sender.
 * Converts standard Markdown and preserves valid Telegram HTML tags with robust error fallback,
 * ensuring no raw HTML tags or malformed entities are ever displayed to the user.
 */

/**
 * Escapes characters for HTML entities (&, <, >)
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Balances unclosed or improperly nested HTML tags for Telegram Bot API.
 * Telegram supports: <b>, <strong>, <i>, <em>, <u>, <ins>, <s>, <strike>, <del>, <code>, <pre>, <blockquote>, <a>, <tg-spoiler>
 */
function balanceTelegramTags(html) {
  const supportedTags = [
    "b",
    "strong",
    "i",
    "em",
    "u",
    "ins",
    "s",
    "strike",
    "del",
    "code",
    "pre",
    "blockquote",
    "a",
    "tg-spoiler",
  ];
  const tagRegex = /<\/?([a-zA-Z0-9_-]+)(?:\s+[^>]*)?>/g;
  const stack = [];
  let match;

  while ((match = tagRegex.exec(html)) !== null) {
    const fullTag = match[0];
    const tagName = match[1].toLowerCase();
    const isClosing = fullTag.startsWith("</");

    if (!supportedTags.includes(tagName)) continue;

    if (!isClosing) {
      stack.push(tagName);
    } else {
      if (stack.length > 0 && stack[stack.length - 1] === tagName) {
        stack.pop();
      } else {
        const lastIdx = stack.lastIndexOf(tagName);
        if (lastIdx !== -1) {
          stack.splice(lastIdx, 1);
        }
      }
    }
  }

  // Close any unclosed tags in reverse order
  while (stack.length > 0) {
    const tag = stack.pop();
    html += `</${tag}>`;
  }

  return html;
}

/**
 * Strips all HTML tags and unescapes entities to produce clean, safe plain text
 */
function stripHtmlToCleanText(html) {
  if (!html) return "";
  return String(html)
    .replace(/<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, "\n$1\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * Converts Markdown text into valid Telegram Bot API HTML while preserving existing valid HTML tags.
 * Protects code blocks, inline code, and existing Telegram HTML from accidental double-escaping.
 */
function markdownToTelegramHtml(markdown) {
  if (!markdown) return "";
  let text = String(markdown);

  // 1. Extract and protect multi-line code blocks ```lang\ncode```
  const codeBlocks = [];
  text = text.replace(/```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)```/g, (match, lang, code) => {
    const escapedCode = escapeHtml(code);
    const placeholder = `\x00CB${codeBlocks.length}\x00`;
    if (lang && lang.trim()) {
      codeBlocks.push(`<pre><code class="language-${escapeHtml(lang.trim())}">${escapedCode}</code></pre>`);
    } else {
      codeBlocks.push(`<pre>${escapedCode}</pre>`);
    }
    return placeholder;
  });

  // 2. Extract and protect inline code `code`
  const inlineCodes = [];
  text = text.replace(/`([^`\n]+)`/g, (match, code) => {
    const escapedCode = escapeHtml(code);
    const placeholder = `\x00IC${inlineCodes.length}\x00`;
    inlineCodes.push(`<code>${escapedCode}</code>`);
    return placeholder;
  });

  // 3. Extract and protect existing VALID Telegram HTML tags so they are not escaped into &lt;b&gt;
  const existingTags = [];
  const validTagRegex = /<\/?(?:b|strong|i|em|u|ins|s|strike|del|code|pre|blockquote|tg-spoiler|a(?:\s+href="[^"]*")?)\s*\/?>/gi;
  text = text.replace(validTagRegex, (match) => {
    const placeholder = `\x00HT${existingTags.length}\x00`;
    existingTags.push(match);
    return placeholder;
  });

  // 4. Escape general HTML entities in remaining raw text (&, <, >)
  // Only escape & if not part of an existing entity like &amp; &lt; &gt; &quot;
  text = text
    .replace(/&(?!amp;|lt;|gt;|quot;|#\d+;)/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 5. Blockquotes: lines starting with &gt;
  text = text.replace(/(?:^|\n)(&gt;[^\n]*(?:\n&gt;[^\n]*)*)/g, (match, quoteBlock) => {
    const cleanedQuote = quoteBlock
      .split("\n")
      .map((line) => line.replace(/^&gt;\s?/, ""))
      .join("\n")
      .trim();
    return `\n<blockquote>${cleanedQuote}</blockquote>\n`;
  });

  // 6. Headers: # Header -> <b>Header</b>
  text = text.replace(/^[ \t]*#{1,6}[ \t]+(.*)$/gm, "<b>$1</b>");

  // 7. Horizontal rules: --- or ***
  text = text.replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, "—".repeat(20));

  // 8. Bullet lists: lines starting with *, -, + followed by space -> • 
  text = text.replace(/^[ \t]*[\*\-\+][ \t]+(.*)$/gm, "• $1");

  // 9. Markdown Links: [title](url)
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, '<a href="$2">$1</a>');

  // 10. Bold: **text** or *text* (word boundary) or __text__
  text = text.replace(/\*\*([^*\n]+?)\*\*/g, "<b>$1</b>");
  text = text.replace(/__([^_\n]+?)__/g, "<b>$1</b>");
  text = text.replace(/(^|[\s.,!?;:("'])\*([^*\n]+?)\*(?=[\s.,!?;:)"']|$)/g, "$1<b>$2</b>");

  // 11. Strikethrough: ~~text~~
  text = text.replace(/~~([^~\n]+?)~~/g, "<s>$1</s>");

  // 12. Italic: _text_ (surrounded by space/punctuation, not inside identifiers like chat_id)
  text = text.replace(/(^|[\s.,!?;:("'])_([^_\n]+?)_(?=[\s.,!?;:)"']|$)/g, "$1<i>$2</i>");

  // 13. Restore existing valid HTML tags
  text = text.replace(/\x00HT(\d+)\x00/g, (match, idx) => existingTags[parseInt(idx, 10)] || "");

  // 14. Restore inline code
  text = text.replace(/\x00IC(\d+)\x00/g, (match, idx) => inlineCodes[parseInt(idx, 10)] || "");

  // 15. Restore code blocks
  text = text.replace(/\x00CB(\d+)\x00/g, (match, idx) => codeBlocks[parseInt(idx, 10)] || "");

  // 16. HTML Tag Balance Validator
  text = balanceTelegramTags(text);

  return text.trim();
}

/**
 * Splits response text into natural human-like conversational parts (1-3 bubbles).
 * Preserves code blocks, tables, and numbered lists as single coherent blocks.
 * Enforces a strict 3800-character ceiling per chunk so Telegram's 4096 limit is never exceeded.
 */
function splitIntoHumanChunks(text, maxChunks = 3) {
  if (!text) return [];
  const clean = text.trim();

  // If text contains code blocks or pre tags, don't split unless it exceeds 3800 chars
  if ((clean.includes("```") || clean.includes("<pre>") || /^\s*\d+[\.\)]\s/m.test(clean)) && clean.length <= 3800) {
    return [clean];
  }

  // 1. Split on true paragraph breaks (double newlines)
  let paragraphs = clean
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length >= 2 && paragraphs.length <= maxChunks) {
    const allFit = paragraphs.every((p) => p.length <= 3800);
    if (allFit) return paragraphs;
  }

  // If more paragraphs than maxChunks or any paragraph is huge, merge into sensible chunks <= 3800 chars
  const chunks = [];
  let currentChunk = "";

  for (const para of paragraphs) {
    if (currentChunk.length + para.length + 2 <= 3800) {
      currentChunk = currentChunk ? `${currentChunk}\n\n${para}` : para;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      if (para.length > 3800) {
        // Fallback split for massive continuous text
        for (let i = 0; i < para.length; i += 3800) {
          chunks.push(para.slice(i, i + 3800));
        }
        currentChunk = "";
      } else {
        currentChunk = para;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks.length > 0 ? chunks.slice(0, Math.max(maxChunks, chunks.length)) : [clean];
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
    console.warn("HTML formatting failed, sending clean plain text fallback:", htmlErr.message);
    const cleanText = stripHtmlToCleanText(html);
    return await ctx.reply(cleanText, {
      ...extra,
      disable_web_page_preview: false,
    });
  }
}

/**
 * Safely sends a formatted message to a chatId using the bot instance with HTML parse mode and fallback
 */
async function sendSafeTelegramMessage(bot, chatId, text, extra = {}) {
  const html = markdownToTelegramHtml(text);

  try {
    return await bot.telegram.sendMessage(chatId, html, {
      ...extra,
      parse_mode: "HTML",
      disable_web_page_preview: false,
    });
  } catch (htmlErr) {
    console.warn(`HTML sendMessage failed for ${chatId}, sending clean plain text fallback:`, htmlErr.message);
    const cleanText = stripHtmlToCleanText(html);
    return await bot.telegram.sendMessage(chatId, cleanText, {
      ...extra,
      disable_web_page_preview: false,
    });
  }
}

/**
 * Sends a message in natural human-paced conversational bubbles with micro-typing indicators.
 * Runs in the same single Lambda invocation with zero additional costs or cold starts.
 */
async function sendTelegramHumanPaced(ctx, text, extra = {}) {
  const chunks = splitIntoHumanChunks(text, 3);
  const sentMessages = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    // If not the first bubble, display natural typing indicator and a micro-delay (400ms - 800ms)
    if (i > 0) {
      await ctx.sendChatAction("typing").catch(() => {});
      const pacingDelay = Math.floor(Math.random() * 400) + 400; // 400ms - 800ms
      await new Promise((resolve) => setTimeout(resolve, pacingDelay));
    }

    const sent = await sendTelegramFormatted(ctx, chunk, extra);
    sentMessages.push(sent);
  }

  return sentMessages;
}

module.exports = {
  markdownToTelegramHtml,
  balanceTelegramTags,
  stripHtmlToCleanText,
  splitIntoHumanChunks,
  sendTelegramFormatted,
  sendSafeTelegramMessage,
  sendTelegramHumanPaced,
};
