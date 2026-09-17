const Memory = require("../models/Memory");
const { generateEmbedding, cosineSimilarity } = require("./embeddingService");

/**
 * Retrieve the most semantically relevant memories for a user given a natural language query.
 * @param {Object} params
 * @param {number|string} params.chatId - Telegram Chat ID
 * @param {string} params.query - The user message / question
 * @param {number} [params.limit=5] - Maximum number of relevant memories to retrieve
 * @param {number} [params.minSimilarity=0.38] - Minimum cosine similarity threshold
 * @returns {Promise<Array<{ memory: Object, similarity: number }>>}
 */
async function retrieveRelevantMemories({
  chatId,
  query,
  limit = 5,
  minSimilarity = 0.38,
}) {
  if (!query || typeof query !== "string" || !query.trim()) {
    return [];
  }

  // 1. Generate query embedding via Amazon Titan v2
  const queryEmbedding = await generateEmbedding(query);
  if (!queryEmbedding) {
    return [];
  }

  // 2. Fetch all memories for this user with embeddings
  const memories = await Memory.find({
    chatId,
    embedding: { $exists: true, $not: { $size: 0 } },
  }).lean();

  if (!memories || memories.length === 0) {
    return [];
  }

  // 3. Compute cosine similarity for each document
  const scored = [];
  for (const mem of memories) {
    if (Array.isArray(mem.embedding) && mem.embedding.length > 0) {
      const score = cosineSimilarity(queryEmbedding, mem.embedding);
      if (score >= minSimilarity) {
        scored.push({
          memory: mem,
          similarity: Math.round(score * 1000) / 1000,
        });
      }
    }
  }

  // 4. Rank by descending similarity and return top-K
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, limit);
}

/**
 * Formats retrieved RAG memories into a clean string for prompt injection
 * @param {Array<{ memory: Object, similarity: number }>} relevantItems
 * @param {string} userTimezone
 * @returns {string}
 */
function formatRagContext(relevantItems, userTimezone = "Asia/Kolkata") {
  if (!relevantItems || relevantItems.length === 0) {
    return "";
  }

  let text = "🧠 RELEVANT HISTORICAL KNOWLEDGE & MEMORIES (SEMANTIC RAG):\n";
  text += "(These items were semantically matched from the user's past notes, goals, ideas, and tasks based on their current question)\n";

  relevantItems.forEach(({ memory: m, similarity }, i) => {
    const status = m.completed ? "COMPLETED" : "ACTIVE / PENDING";
    const dateStr = m.date
      ? ` | Due/Date: ${new Date(m.date).toLocaleDateString("en-US", { timeZone: userTimezone })}`
      : "";
    const projectStr = m.projectName ? ` | Project: "${m.projectName}"` : "";
    const urlStr = m.url ? ` | Link: ${m.url}` : "";

    text += `${i + 1}. [${m.type.toUpperCase()}] "${m.content}" (Status: ${status}${projectStr}${urlStr}${dateStr}) [Similarity: ${Math.round(similarity * 100)}%]\n`;
  });

  return text.trim();
}

module.exports = {
  retrieveRelevantMemories,
  formatRagContext,
};
