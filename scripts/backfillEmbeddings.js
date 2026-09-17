require("dotenv").config();
const mongoose = require("mongoose");
const { connectToDatabase } = require("../src/config/db");
const Memory = require("../src/models/Memory");
const { generateEmbedding } = require("../src/services/embeddingService");

async function backfill() {
  console.log("🚀 Starting Amazon Titan v2 Embedding Backfill...");
  await connectToDatabase();
  console.log("📦 Connected to MongoDB Atlas.");

  const unindexedMemories = await Memory.find({
    $or: [{ embedding: { $exists: false } }, { embedding: { $size: 0 } }],
  });

  console.log(`Found ${unindexedMemories.length} memories without embeddings.`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < unindexedMemories.length; i++) {
    const mem = unindexedMemories[i];
    const textToEmbed = `${mem.type || "task"}: ${mem.content}${mem.projectName ? ` (Project: ${mem.projectName})` : ""}${mem.tags && mem.tags.length ? ` (Tags: ${mem.tags.join(", ")})` : ""}`;

    try {
      const embedding = await generateEmbedding(textToEmbed);
      if (embedding && embedding.length > 0) {
        await Memory.findByIdAndUpdate(mem._id, { embedding });
        successCount++;
        console.log(`[${i + 1}/${unindexedMemories.length}] ✅ Embedded: "${mem.content.slice(0, 40)}..."`);
      } else {
        failCount++;
        console.warn(`[${i + 1}/${unindexedMemories.length}] ⚠️ Failed embedding for ID: ${mem._id}`);
      }
    } catch (err) {
      failCount++;
      console.error(`[${i + 1}/${unindexedMemories.length}] ❌ Error embedding ID ${mem._id}:`, err.message);
    }
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`🎉 Backfill Complete! Success: ${successCount} | Failed: ${failCount}`);
  process.exit(0);
}

backfill().catch((err) => {
  console.error("Fatal Backfill error:", err);
  process.exit(1);
});
