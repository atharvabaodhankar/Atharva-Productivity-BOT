const { InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");
const { getBedrockClient, isBedrockConfigured } = require("../ai/bedrockClient");

const TITAN_EMBEDDING_MODEL_ID = process.env.BEDROCK_EMBEDDING_MODEL_ID || "amazon.titan-embed-text-v2:0";

/**
 * Generate normalized text embeddings using Amazon Titan Text Embeddings v2
 * @param {string} text - The input text to embed
 * @param {number} dimensions - Embedding dimension (default: 512)
 * @returns {Promise<number[]|null>} - 512-dimension vector array or null if failed
 */
async function generateEmbedding(text, dimensions = 512) {
  if (!text || typeof text !== "string" || !text.trim()) {
    return null;
  }

  const client = getBedrockClient();
  if (!client) {
    console.warn("⚠️ Bedrock client not configured for embeddings.");
    return null;
  }

  try {
    const payload = {
      inputText: text.trim().slice(0, 8000), // Titan v2 token limit safe ceiling
      dimensions,
      normalize: true,
    };

    const command = new InvokeModelCommand({
      modelId: TITAN_EMBEDDING_MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    });

    const response = await client.send(command);
    const data = JSON.parse(new TextDecoder().decode(response.body));

    if (data && Array.isArray(data.embedding)) {
      return data.embedding;
    }
    return null;
  } catch (error) {
    console.error("Embedding generation error (Titan v2):", error.message);
    return null;
  }
}

/**
 * Calculate Cosine Similarity between two normalized vectors
 * Since Titan v2 vectors are normalized (magnitude = 1), cosine similarity is the dot product.
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number} - Similarity score between -1.0 and 1.0 (typically 0.0 to 1.0 for text)
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }

  let dotProduct = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
  }
  return dotProduct;
}

module.exports = {
  generateEmbedding,
  cosineSimilarity,
  isBedrockConfigured,
  TITAN_EMBEDDING_MODEL_ID,
};
