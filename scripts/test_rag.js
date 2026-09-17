require("dotenv").config();
const { connectToDatabase } = require("../src/config/db");
const Memory = require("../src/models/Memory");
const { retrieveRelevantMemories } = require("../src/services/ragService");
const { askAI } = require("../src/ai/aiService");

async function verifyRag() {
  await connectToDatabase();
  console.log("Connected to MongoDB Atlas for RAG validation.\n");

  // Find a memory about Rust
  const rustMem = await Memory.findOne({ content: /rust/i });
  console.log(`Found sample Rust memory under chatId: ${rustMem?.chatId} -> "${rustMem?.content}"`);

  if (rustMem) {
    const results1 = await retrieveRelevantMemories({
      chatId: rustMem.chatId,
      query: "What did I plan or note about learning Rust language?",
      limit: 5,
      minSimilarity: 0.35,
    });
    console.log(`\n--- RAG Results for: "What did I plan or note about learning Rust language?" ---`);
    results1.forEach((r, i) => {
      console.log(`${i + 1}. (${Math.round(r.similarity * 100)}%) [${r.memory.type}] "${r.memory.content}"`);
    });

    const reply1 = await askAI({
      message: "What were my study plans and notes for Rust programming?",
      chatId: rustMem.chatId,
      senderName: "Krushnali",
    });
    console.log("\n🤖 AI Final Response for Rust:\n", reply1);
  }

  // Find a memory about medicine
  const medMem = await Memory.findOne({ content: /sirup|goli|medicine/i });
  console.log(`\nFound sample Medicine memory under chatId: ${medMem?.chatId} -> "${medMem?.content}"`);

  if (medMem) {
    const results2 = await retrieveRelevantMemories({
      chatId: medMem.chatId,
      query: "What medicine or syrup do I need to take?",
      limit: 5,
      minSimilarity: 0.35,
    });
    console.log(`\n--- RAG Results for: "What medicine or syrup do I need to take?" ---`);
    results2.forEach((r, i) => {
      console.log(`${i + 1}. (${Math.round(r.similarity * 100)}%) [${r.memory.type}] "${r.memory.content}"`);
    });

    const reply2 = await askAI({
      message: "What medicine or syrup do I need to take?",
      chatId: medMem.chatId,
      senderName: "Friend",
    });
    console.log("\n🤖 AI Final Response for Medicine:\n", reply2);
  }

  process.exit(0);
}

verifyRag().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
