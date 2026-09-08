const { BedrockRuntimeClient, ConverseCommand } = require("@aws-sdk/client-bedrock-runtime");
const {
  AWS_REGION,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  BEDROCK_LLM_MODEL_ID,
} = require("../config/env");

let bedrockClient = null;

function getBedrockClient() {
  if (!bedrockClient) {
    const region =
      process.env.BEDROCK_AWS_REGION ||
      process.env.AWS_REGION ||
      AWS_REGION ||
      "ap-south-1";
    const accessKeyId =
      process.env.BEDROCK_AWS_ACCESS_KEY_ID ||
      process.env.AWS_ACCESS_KEY_ID ||
      AWS_ACCESS_KEY_ID;
    const secretAccessKey =
      process.env.BEDROCK_AWS_SECRET_ACCESS_KEY ||
      process.env.AWS_SECRET_ACCESS_KEY ||
      AWS_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) {
      return null;
    }

    bedrockClient = new BedrockRuntimeClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return bedrockClient;
}

function isBedrockConfigured() {
  const accessKeyId =
    process.env.BEDROCK_AWS_ACCESS_KEY_ID ||
    process.env.AWS_ACCESS_KEY_ID ||
    AWS_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.BEDROCK_AWS_SECRET_ACCESS_KEY ||
    process.env.AWS_SECRET_ACCESS_KEY ||
    AWS_SECRET_ACCESS_KEY;

  return Boolean(accessKeyId && secretAccessKey);
}

// Convert OpenAI tool definitions to Bedrock toolSpec format
function convertToolsToBedrockSpec(tools) {
  if (!tools || !Array.isArray(tools)) return undefined;

  const bedrockTools = tools.map((t) => {
    const fn = t.function || t;
    return {
      toolSpec: {
        name: fn.name,
        description: fn.description || "",
        inputSchema: {
          json: fn.parameters || { type: "object", properties: {} },
        },
      },
    };
  });

  return { tools: bedrockTools };
}

// Convert base64 data URL to Bedrock image block
function parseBase64Image(dataUrl) {
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/i);
  if (!match) {
    // Default to jpeg if no prefix
    return {
      format: "jpeg",
      source: { bytes: Buffer.from(dataUrl.replace(/^data:[^;]+;base64,/, ""), "base64") },
    };
  }
  const rawFormat = match[1].toLowerCase();
  const format = rawFormat === "jpg" ? "jpeg" : rawFormat;
  const bytes = Buffer.from(match[2], "base64");
  return { format, source: { bytes } };
}

module.exports = {
  getBedrockClient,
  isBedrockConfigured,
  convertToolsToBedrockSpec,
  parseBase64Image,
  ConverseCommand,
};
