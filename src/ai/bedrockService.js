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

  // Model selection: Nova Lite for high-intelligence reasoning, structured coding, tools, and vision
  const modelId = process.env.BEDROCK_LLM_MODEL_ID || BEDROCK_LLM_MODEL_ID || "apac.amazon.nova-lite-v1:0";

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

  // 1. Ensure conversation starts with a user message (strict AWS Bedrock requirement)
  while (bedrockMessages.length > 0 && bedrockMessages[0].role !== "user") {
    bedrockMessages.shift();
  }

  // 2. Enforce strict role alternation (merge consecutive messages with identical role)
  const cleanBedrockMessages = [];
  for (const msg of bedrockMessages) {
    if (cleanBedrockMessages.length === 0) {
      if (msg.role === "user") cleanBedrockMessages.push(msg);
    } else {
      const lastMsg = cleanBedrockMessages[cleanBedrockMessages.length - 1];
      if (lastMsg.role === msg.role) {
        lastMsg.content.push(...msg.content);
      } else {
        cleanBedrockMessages.push(msg);
      }
    }
  }

  // 3. Ensure conversation ends with the latest user message
  if (cleanBedrockMessages.length === 0) {
    cleanBedrockMessages.push({
      role: "user",
      content: [{ text: "Hello" }],
    });
  } else if (cleanBedrockMessages[cleanBedrockMessages.length - 1].role !== "user") {
    cleanBedrockMessages.push({
      role: "user",
      content: [{ text: "Please assist." }],
    });
  }

  const toolConfig = tools ? convertToolsToBedrockSpec(tools) : undefined;
  const system = systemPrompt ? [{ text: systemPrompt }] : undefined;

  const command = new ConverseCommand({
    modelId,
    system,
    messages: cleanBedrockMessages,
    toolConfig,
    inferenceConfig: {
      temperature: 0.7,
      maxTokens: 1500,
    },
  });

  const response = await client.send(command);
  const responseMessage = response.output.message;
  cleanBedrockMessages.push(responseMessage);

  const usage1 = response.usage || {};
  let usage2 = {};

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

    cleanBedrockMessages.push({
      role: "user",
      content: toolResults,
    });

    // Follow-up call with tool execution results
    const followUpCmd = new ConverseCommand({
      modelId,
      system,
      messages: cleanBedrockMessages,
      toolConfig,
      inferenceConfig: {
        temperature: 0.7,
        maxTokens: 1500,
      },
    });

    const followUpRes = await client.send(followUpCmd);
    usage2 = followUpRes.usage || {};

    // Record total tokens consumed across both tool steps
    const { recordTokenUsage } = require("../services/statsService");
    const totalIn = (usage1.inputTokens || 0) + (usage2.inputTokens || 0);
    const totalOut = (usage1.outputTokens || 0) + (usage2.outputTokens || 0);
    recordTokenUsage({
      model: modelId,
      inputTokens: totalIn,
      outputTokens: totalOut,
      totalTokens: totalIn + totalOut,
    }).catch(() => {});

    const finalContent = (followUpRes.output.message.content || [])
      .map((c) => c.text || "")
      .join("\n")
      .trim();
    return finalContent;
  }

  // Record tokens for single-turn text response
  const { recordTokenUsage } = require("../services/statsService");
  recordTokenUsage({
    model: modelId,
    inputTokens: usage1.inputTokens || 0,
    outputTokens: usage1.outputTokens || 0,
    totalTokens: (usage1.inputTokens || 0) + (usage1.outputTokens || 0),
  }).catch(() => {});

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
