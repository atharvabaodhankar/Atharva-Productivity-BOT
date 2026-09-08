const {
  getBedrockClient,
  isBedrockConfigured,
  convertToolsToBedrockSpec,
  parseBase64Image,
  ConverseCommand,
} = require("./bedrockClient");
const { BEDROCK_LLM_MODEL_ID } = require("../config/env");

async function executeBedrockConverse({
  messages,
  systemPrompt,
  tools,
  base64ImageUrl,
  executeToolHandler,
  chatId,
}) {
  const client = getBedrockClient();
  if (!client) {
    throw new Error("Bedrock client not initialized.");
  }

  // Model selection: Nova Lite for vision, Nova Micro for text & tools
  const modelId = base64ImageUrl
    ? "apac.amazon.nova-lite-v1:0"
    : (process.env.BEDROCK_LLM_MODEL_ID || BEDROCK_LLM_MODEL_ID || "apac.amazon.nova-micro-v1:0");

  const bedrockMessages = [];

  // Build the message list
  for (const m of messages) {
    if (m.role === "system") continue; // Bedrock takes system prompt in top-level parameter

    const contentBlocks = [];

    if (base64ImageUrl && m.role === "user") {
      const imgBlock = parseBase64Image(base64ImageUrl);
      contentBlocks.push({ image: imgBlock });
    }

    if (typeof m.content === "string" && m.content.trim()) {
      contentBlocks.push({ text: m.content });
    } else if (Array.isArray(m.content)) {
      for (const item of m.content) {
        if (item.type === "text" && item.text) {
          contentBlocks.push({ text: item.text });
        }
      }
    }

    if (contentBlocks.length > 0) {
      bedrockMessages.push({
        role: m.role === "assistant" ? "assistant" : "user",
        content: contentBlocks,
      });
    }
  }

  const toolConfig = tools ? convertToolsToBedrockSpec(tools) : undefined;
  const system = systemPrompt ? [{ text: systemPrompt }] : undefined;

  const command = new ConverseCommand({
    modelId,
    system,
    messages: bedrockMessages,
    toolConfig,
    inferenceConfig: {
      temperature: 0.7,
      maxTokens: 1500,
    },
  });

  const response = await client.send(command);
  const responseMessage = response.output.message;
  bedrockMessages.push(responseMessage);

  // Check for tool use
  const toolUseBlocks = (responseMessage.content || []).filter((c) => c.toolUse);

  if (toolUseBlocks.length > 0 && executeToolHandler) {
    const toolResults = [];

    for (const block of toolUseBlocks) {
      const toolUse = block.toolUse;
      const fnName = toolUse.name;
      const args = toolUse.input || {};

      let resultContent = "";
      try {
        resultContent = await executeToolHandler(fnName, args, chatId);
      } catch (err) {
        resultContent = `Error: ${err.message}`;
      }

      toolResults.push({
        toolResult: {
          toolUseId: toolUse.toolUseId,
          content: [{ text: String(resultContent) }],
        },
      });
    }

    bedrockMessages.push({
      role: "user",
      content: toolResults,
    });

    // Follow-up call with tool execution results
    const followUpCmd = new ConverseCommand({
      modelId,
      system,
      messages: bedrockMessages,
      toolConfig,
      inferenceConfig: {
        temperature: 0.7,
        maxTokens: 1500,
      },
    });

    const followUpRes = await client.send(followUpCmd);
    const finalContent = (followUpRes.output.message.content || [])
      .map((c) => c.text || "")
      .join("\n")
      .trim();
    return finalContent;
  }

  // If no tools called, return text response
  const textOutput = (responseMessage.content || [])
    .map((c) => c.text || "")
    .join("\n")
    .trim();

  return textOutput;
}

module.exports = {
  executeBedrockConverse,
  isBedrockConfigured,
};
