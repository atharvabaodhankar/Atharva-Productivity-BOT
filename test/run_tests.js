const assert = require("assert");
const { parseUserDate } = require("../src/utils/dateHelper");
const { sanitizeOutput } = require("../src/ai/aiService");
const {
  markdownToTelegramHtml,
  balanceTelegramTags,
  splitIntoHumanChunks,
} = require("../src/utils/telegramFormatter");
const { buildSystemPrompt } = require("../src/ai/promptEngine");
const { formatRagContext } = require("../src/services/ragService");
const { BEDROCK_LLM_MODEL_ID } = require("../src/config/env");

console.log("🧪 Starting AtharvaOS Test Suite...\n");

let passed = 0;
let total = 0;

function it(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

// 1. Date Parser Tests
console.log("📅 1. Date Helper & Natural Language Parser:");

it("parses standard ISO date with offset", () => {
  const d = parseUserDate("2026-10-26T18:00:00+05:30");
  assert.ok(d instanceof Date);
  assert.strictEqual(d.toISOString(), "2026-10-26T12:30:00.000Z");
});

it("parses relative minutes ('in 15 minutes')", () => {
  const before = Date.now();
  const d = parseUserDate("in 15 minutes");
  const diff = d.getTime() - before;
  assert.ok(diff >= 14 * 60 * 1000 && diff <= 16 * 60 * 1000);
});

it("parses Hinglish relative hours ('2 ghante baad')", () => {
  const before = Date.now();
  const d = parseUserDate("2 ghante baad");
  const diff = d.getTime() - before;
  assert.ok(diff >= 119 * 60 * 1000 && diff <= 121 * 60 * 1000);
});

it("parses 'aadhe ghante baad' to 30 minutes", () => {
  const before = Date.now();
  const d = parseUserDate("aadhe ghante baad");
  const diff = d.getTime() - before;
  assert.ok(diff >= 29 * 60 * 1000 && diff <= 31 * 60 * 1000);
});

it("parses time strings like '20:00'", () => {
  const d = parseUserDate("20:00", "Asia/Kolkata");
  assert.ok(d instanceof Date);
  assert.strictEqual(d.getUTCMinutes(), 30);
  assert.strictEqual(d.getUTCHours(), 14);
});

// 2. Sanitizer Pipeline Tests
console.log("\n🛡️ 2. Output Sanitizer & Anti-Leak Pipeline:");

it("strips MongoDB ObjectIds and 'Here are the IDs' completely", () => {
  const raw = 'Added project "Tech". Here are the IDs for future reference: - Tech: 6add93c6d9308694ff1e1a91';
  const clean = sanitizeOutput(raw);
  assert.ok(!clean.includes("6add93c6d9308694ff1e1a91"));
  assert.ok(!clean.includes("Here are the IDs"));
});

it("strips task ID sentence structures", () => {
  const raw = 'The task ID is 6adec38aaba8df5d878e1c7a for your reference.';
  const clean = sanitizeOutput(raw);
  assert.ok(!clean.includes("6adec38aaba8df5d878e1c7a"));
  assert.ok(!clean.includes("task ID is"));
});

it("strips raw RAG similarity percentages and internal status", () => {
  const raw = 'Reminder for 2:10 PM today (Status: COMPLETED | Due/Date: 10/18/2026) [Similarity: 45%]';
  const clean = sanitizeOutput(raw);
  assert.strictEqual(clean, "Reminder for 2:10 PM today");
});

it("preserves C++ headers (#include <iostream>) and does not strip code brackets", () => {
  const raw = '#include <iostream>\n#include <vector>\nusing namespace std;';
  const clean = sanitizeOutput(raw);
  assert.ok(clean.includes("#include <iostream>"));
  assert.ok(clean.includes("#include <vector>"));
});

it("preserves double asterisks (**bold**) for the HTML parser", () => {
  const raw = '**Important Note:** Always review your tasks.';
  const clean = sanitizeOutput(raw);
  assert.ok(clean.includes("**Important Note:**"));
});

it("strips reasoning blocks (<think>...</think>)", () => {
  const raw = '<think>I should tell the user about the tasks</think>Here are your tasks!';
  const clean = sanitizeOutput(raw);
  assert.strictEqual(clean, "Here are your tasks!");
});

// 3. Telegram HTML Formatter & Parser
console.log("\n💬 3. Telegram HTML Formatter & Tag Balancer:");

it("correctly handles bullet lists with asterisks without generating invalid <b> tags", () => {
  const md = "* Item 1\n* Item 2 with **bold**\n* Item 3";
  const html = markdownToTelegramHtml(md);
  assert.ok(html.includes("• Item 1"));
  assert.ok(html.includes("• Item 2 with <b>bold</b>"));
  assert.ok(html.includes("• Item 3"));
  assert.ok(!html.includes("<b> Item"));
});

it("formats code blocks with language specifiers and escapes HTML entities", () => {
  const md = "```cpp\n#include <iostream>\nint a = 5 < 10;\n```";
  const html = markdownToTelegramHtml(md);
  assert.ok(html.includes('<pre><code class="language-cpp">'));
  assert.ok(html.includes("#include &lt;iostream&gt;"));
  assert.ok(html.includes("5 &lt; 10;"));
  assert.ok(html.includes("</code></pre>"));
});

it("safely handles underscores in variable names without corrupting italic", () => {
  const md = "Check chat_id and user_id in database. Also _this is italic_!";
  const html = markdownToTelegramHtml(md);
  assert.ok(html.includes("chat_id"));
  assert.ok(html.includes("user_id"));
  assert.ok(html.includes("<i>this is italic</i>"));
});

it("auto-balances unclosed HTML tags to prevent Telegram 400 Bad Request", () => {
  const broken = "<b>This bold tag was never closed!";
  const balanced = balanceTelegramTags(broken);
  assert.strictEqual(balanced, "<b>This bold tag was never closed!</b>");
});

it("formats headers as bold and blockquotes as <blockquote>", () => {
  const md = "### Architecture\n> Do not multitask";
  const html = markdownToTelegramHtml(md);
  assert.ok(html.includes("<b>Architecture</b>"));
  assert.ok(html.includes("<blockquote>Do not multitask</blockquote>"));
});

// 4. Human-Paced Chunking
console.log("\n📦 4. Human-Paced Chunking & Length Constraints:");

it("does not split code blocks across message bubbles", () => {
  const code = 'Here is the code:\n```cpp\n#include <iostream>\nint main() {}\n```\nEnjoy coding!';
  const chunks = splitIntoHumanChunks(code);
  assert.strictEqual(chunks.length, 1);
  assert.ok(chunks[0].includes("```cpp"));
});

it("splits distinct paragraphs naturally without breaking sentences", () => {
  const text = 'Paragraph 1: Welcome to AtharvaOS.\n\nParagraph 2: Ready to conquer today?';
  const chunks = splitIntoHumanChunks(text);
  assert.strictEqual(chunks.length, 2);
  assert.strictEqual(chunks[0], "Paragraph 1: Welcome to AtharvaOS.");
  assert.strictEqual(chunks[1], "Paragraph 2: Ready to conquer today?");
});

it("enforces chunk length limit <= 3800 characters to never breach Telegram 4096 ceiling", () => {
  const longText = "A".repeat(5000);
  const chunks = splitIntoHumanChunks(longText);
  assert.ok(chunks.length >= 2);
  chunks.forEach((chunk) => assert.ok(chunk.length <= 3800));
});

// 5. System Prompt & Model Routing
console.log("\n🧠 5. System Prompt Architecture & High-IQ Defaults:");

it("replaces raw [ID: ...] with [ref_id: ...] and sets strict coding rules", () => {
  const prompt = buildSystemPrompt({
    user: { telegramId: 5275149287, firstName: "Atharva" },
    memories: [{ _id: "6add93c6d9308694ff1e1a91", type: "task", content: "Test task", completed: false }],
    pendingTasksCount: 1,
    historyText: "",
  });
  assert.ok(prompt.includes("[ref_id: 6add93c6d9308694ff1e1a91]"));
  assert.ok(!prompt.includes("[ID: 6add93c6d9308694ff1e1a91]"));
  assert.ok(prompt.includes("CODING, TECH, STUDY & KNOWLEDGE QUESTIONS"));
  assert.ok(prompt.includes("STRICT INTENT-BASED TOOL CALLING"));
});

it("formats RAG context cleanly without similarity numbers", () => {
  const rag = formatRagContext([{ memory: { type: "task", content: "Build OS" }, similarity: 0.89 }]);
  assert.ok(rag.includes('[TASK] "Build OS"'));
  assert.ok(!rag.includes("Similarity:"));
});

it("ensures BEDROCK_LLM_MODEL_ID defaults to apac.amazon.nova-lite-v1:0", () => {
  assert.strictEqual(BEDROCK_LLM_MODEL_ID, "apac.amazon.nova-lite-v1:0");
});

// Summary
console.log(`\n========================================`);
console.log(`Results: ${passed} / ${total} tests passed! ✨`);
console.log(`========================================\n`);

if (passed !== total) {
  process.exit(1);
}
