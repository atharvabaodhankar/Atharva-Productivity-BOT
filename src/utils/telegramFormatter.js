/**
 * Safe Telegram HTML formatter and Human-Paced Multi-Bubble Sender.
 * Converts standard Markdown to valid Telegram HTML format with robust error fallback,
 * and splits multi-sentence conversational responses into natural human-like message bubbles.
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

  // Single asterisk bold/italic *text*
  html = html.replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, "$1<b>$2</b>$3");

  // Underscore italic _text_
  html = html.replace(/(^|[^_])_([^_]+)_([^_]|$)/g, "$1<i>$2</i>$3");

  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');

  return html;
}

/**
 * Splits response text into natural human-like conversational parts (1-3 bubbles).
 * Preserves code blocks, tables, and numbered lists as single coherent blocks.
 */
function splitIntoHumanChunks(text, maxChunks = 3) {
  if (!text) return [];
  const clean = text.trim();

  // If text contains code blocks, HTML pre, tables, or numbered task lists, do not split
  if (clean.includes("```") || clean.includes("<pre>") || /^\s*\d+[\.\)]\s/m.test(clean)) {
    return [clean];
  }

  // If text is short (< 140 chars), send as single punchy bubble
  if (clean.length < 140) {
    return [clean];
  }

  // 1. Try splitting by double newline (distinct paragraphs/thoughts)
  let paragraphs = clean
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length >= 2 && paragraphs.length <= maxChunks) {
    return paragraphs;
  }

  // If more paragraphs than maxChunks, merge into maxChunks
  if (paragraphs.length > maxChunks) {
    const merged = [];
    const chunkSize = Math.ceil(paragraphs.length / maxChunks);
    for (let i = 0; i < paragraphs.length; i += chunkSize) {
      merged.push(paragraphs.slice(i, i + chunkSize).join("\n\n"));
    }
    return merged.slice(0, maxChunks);
  }

  // 2. If single long paragraph (> 200 chars), split on natural sentence boundaries
  if (clean.length > 200) {
    const sentences = clean.match(/[^.!?]+[.!?]+(\s+|$)/g);
    if (sentences && sentences.length >= 2) {
      const midpoint = Math.ceil(sentences.length / 2);
      const part1 = sentences.slice(0, midpoint).join("").trim();
      const part2 = sentences.slice(midpoint).join("").trim();
      if (part1 && part2 && part1.length > 30 && part2.length > 30) {
        return [part1, part2];
      }
    }
  }

  return [clean];
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
    console.warn("HTML formatting failed, sending plain text fallback:", htmlErr.message);
    return await ctx.reply(text, {
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
      try {
        await ctx.sendChatAction("typing");
      } catch (e) {}
      const typingDelay = Math.min(Math.max(chunk.length * 8, 400), 800);
      await new Promise((r) => setTimeout(r, typingDelay));
    }

    const sent = await sendTelegramFormatted(ctx, chunk, {
      ...extra,
      // Reply to original message on the first bubble only
      reply_to_message_id: i === 0 ? extra.reply_to_message_id : undefined,
    });
    sentMessages.push(sent);
  }

  return sentMessages;
}

module.exports = {
  markdownToTelegramHtml,
  splitIntoHumanChunks,
  sendTelegramFormatted,
  sendTelegramHumanPaced,
};
