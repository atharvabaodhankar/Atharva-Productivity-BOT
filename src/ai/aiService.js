const { executeWithFailover } = require("./groqPool");
const { executeBedrockConverse, isBedrockConfigured } = require("./bedrockService");
const { tools } = require("./tools");
const { buildSystemPrompt } = require("./promptEngine");
const { parseUserDate } = require("../utils/dateHelper");
const Memory = require("../models/Memory");
const User = require("../models/User");
const mongoose = require("mongoose");
const { getReminders } = require("../services/memoryService");

// Comprehensive sanitizer to strip any leaked reasoning, XML tags, or bot POV scratchpads
function sanitizeOutput(text, userName = "bhai") {
  if (!text) return `Done ${userName}! Maine sab update kar diya hai! ✨`;

  let raw = String(text);

  // 1. Strip all XML/HTML reasoning & tool call tags (including unclosed tags if output was truncated)
  raw = raw
    .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "")
    .replace(/<thinking>[\s\S]*?(?:<\/thinking>|$)/gi, "")
    .replace(/<thought>[\s\S]*?(?:<\/thought>|$)/gi, "")
    .replace(/<reasoning>[\s\S]*?(?:<\/reasoning>|$)/gi, "")
    .replace(/<thought_process>[\s\S]*?(?:<\/thought_process>|$)/gi, "")
    .replace(/<function=[\s\S]*?(?:<\/function>|$)/gi, "")
    .replace(/<tool_call>[\s\S]*?(?:<\/tool_call>|$)/gi, "")
    .replace(/<[\s\S]*?>/g, "");

  // 2. If the model output a structured thought block with a labeled final spoken response:
  const labeledMatch = raw.match(
    /(?:Final\s*(?:Response|Answer|Output|Polish|Reply)|Spoken\s*(?:Response|Text)|Assistant\s*(?:Response|Reply)|Response|Reply):\s*["']?([\s\S]+?)["']?$/i
  );
  if (labeledMatch && labeledMatch[1] && labeledMatch[1].trim().length > 3) {
    raw = labeledMatch[1].trim();
  }

  // 3. Strip explicit bot POV scratchpad headers if present at the beginning
  raw = raw
    .replace(/^(?:AtharvaOS\s*\(Bot POV\)|\[Bot POV\]|Bot POV:?)\s*/i, "")
    .trim();

  // 4. Telegram Markdown Cleanup (convert **bold** to *bold*, remove headers #)
  let cleaned = raw
    .replace(/^["']|["']$/g, "")
    .replace(/^[ \t]*#+[ \t]*/gm, "")
    .replace(/\*\*/g, "*")
    .trim();

  if (!cleaned || cleaned.length < 2) {
    return `Done ${userName}! Maine sab update kar diya hai! ✨`;
  }

  return cleaned;
}

const CASUAL_GREETINGS = new Set([
  "hi", "hello", "hey", "yo", "ho", "haan", "ha", "ok", "okay",
  "kya hal", "kya chal raha", "sup", "wassup", "good morning", "good night", "bye",
  "kesa he bro", "kaisa hai bro", "kaisa he", "who made you"
]);

async function executeToolHandler(functionName, args, chatId, user) {
  if (functionName === "add_memory") {
    const parsedDate = parseUserDate(args.date, user ? user.timezone : "Asia/Kolkata");
    let parentProjectId = null;
    let parentProjectName = "";

    if (args.projectName && args.type !== "project") {
      const trimmedName = args.projectName.trim();
      const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      let existingProj = await Memory.findOne({
        chatId,
        type: "project",
        content: new RegExp(`^${escapedName}$`, "i"),
      });

      if (!existingProj) {
        existingProj = await Memory.findOne({
          chatId,
          type: "project",
          content: new RegExp(escapedName, "i"),
        });
      }

      if (!existingProj) {
        existingProj = await Memory.create({
          chatId,
          type: "project",
          content: trimmedName,
          priority: "medium",
        });
      }

      parentProjectId = existingProj._id;
      parentProjectName = existingProj.content;
    }

    const isRecurring = Boolean(args.isRecurring || args.recurrenceInterval);
    const recurrenceInterval = args.recurrenceInterval || (isRecurring ? "daily" : "");
    const timeOfDay = args.timeOfDay || "";

    let effectiveDate = parsedDate;
    if (isRecurring && parsedDate && parsedDate <= new Date()) {
      const next = new Date(parsedDate);
      while (next <= new Date()) {
        next.setDate(next.getDate() + 1);
      }
      effectiveDate = next;
    }

    const newMem = await Memory.create({
      chatId,
      type: args.type || "task",
      content: args.content,
      url: args.url || "",
      date: effectiveDate,
      priority: args.priority || "medium",
      tags: args.tags || [],
      projectId: parentProjectId,
      projectName: parentProjectName,
      isRecurring,
      recurrenceInterval,
      timeOfDay,
    });

    const parentNote = parentProjectName ? ` (inside project "${parentProjectName}")` : "";
    return `Successfully created ${newMem.type}: "${newMem.content}"${parentNote} (ID: ${newMem._id})`;
  } else if (functionName === "complete_memory") {
    const updated = await Memory.findOneAndUpdate(
      { _id: args.id, chatId },
      { completed: true },
      { new: true }
    );
    return updated
      ? `Marked "${updated.content}" as COMPLETED.`
      : `Item not found.`;
  } else if (functionName === "delete_reminder") {
    const { id, query, deleteAll } = args;
    if (deleteAll) {
      const res = await Memory.deleteMany({ chatId, type: "reminder" });
      return `Successfully deleted all ${res.deletedCount} reminders for you.`;
    } else if (id && mongoose.Types.ObjectId.isValid(id)) {
      const deleted = await Memory.findOneAndDelete({ _id: id, chatId, type: "reminder" });
      return deleted
        ? `Deleted reminder: "${deleted.content}".`
        : `Reminder with ID ${id} not found.`;
    } else if (query || (id && !mongoose.Types.ObjectId.isValid(id))) {
      const searchStr = (query || id).trim();
      const escaped = searchStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const deleted = await Memory.findOneAndDelete({
        chatId,
        type: "reminder",
        content: new RegExp(escaped, "i"),
      });
      return deleted
        ? `Deleted reminder: "${deleted.content}".`
        : `No reminder found matching "${searchStr}".`;
    } else {
      const active = await getReminders(chatId);
      if (active.length === 0) {
        return "No active reminders found to delete.";
      } else if (active.length === 1) {
        await Memory.findByIdAndDelete(active[0]._id);
        return `Deleted your reminder: "${active[0].content}".`;
      } else {
        return `Found multiple active reminders: ${active.map((r) => `"${r.content}" (ID: ${r._id})`).join(", ")}. Please specify which one to delete or say 'delete all reminders'.`;
      }
    }
  } else if (functionName === "delete_memory") {
    let deleted = null;
    if (args.id && mongoose.Types.ObjectId.isValid(args.id)) {
      deleted = await Memory.findOneAndDelete({ _id: args.id, chatId });
    }
    if (!deleted && (args.query || args.id)) {
      const searchStr = (args.query || args.id || "").trim();
      if (searchStr) {
        const escaped = searchStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        deleted = await Memory.findOneAndDelete({
          chatId,
          content: new RegExp(escaped, "i"),
        });
      }
    }
    return deleted
      ? `Deleted ${deleted.type || "item"} "${deleted.content}".`
      : `Item not found.`;
  } else if (functionName === "clear_all_memories") {
    const res = await Memory.deleteMany({ chatId });
    return `Cleared all ${res.deletedCount} items.`;
  }
  return "Unknown tool";
}

async function askAI({
  message,
  chatId,
  historyContext = "",
  base64ImageUrl = null,
  isGroup = false,
  senderName = "Friend",
}) {
  const user = await User.findOne({ telegramId: chatId });
  let memories = [];
  if (!isGroup) {
    const activeReminders = await Memory.find({
      chatId,
      type: "reminder",
      completed: false,
    });
    const otherMemories = await Memory.find({
      chatId,
      $or: [
        { type: { $ne: "reminder" } },
        { completed: true },
      ],
    })
      .sort({ completed: 1, createdAt: -1 })
      .limit(30);

    memories = [...activeReminders, ...otherMemories];
  }

  const pendingTasksCount = isGroup
    ? 0
    : await Memory.countDocuments({
        chatId,
        type: { $in: ["task", "assignment", "project", "exam"] },
        completed: false,
      });

  const systemPrompt = buildSystemPrompt({
    user,
    memories,
    pendingTasksCount,
    historyText: historyContext,
    isGroupChat: isGroup,
    senderName,
  });

  const model = "qwen/qwen3.6-27b";

  const textPrompt =
    message || (base64ImageUrl ? "Analyze this image and extract any tasks or notes." : "");

  let userContent = textPrompt;
  if (base64ImageUrl) {
    userContent = [
      { type: "text", text: textPrompt },
      {
        type: "image_url",
        image_url: { url: base64ImageUrl },
      },
    ];
  }

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];

  const cleanInput = (message || "").trim().toLowerCase();
  const isDirectChat = CASUAL_GREETINGS.has(cleanInput) || isGroup || !!base64ImageUrl;

  let responseMessage;

  const displayName = user?.firstName || senderName || "bhai";

  // 1. Primary: If Amazon Bedrock is configured, invoke Bedrock first!
  if (isBedrockConfigured()) {
    try {
      const bedrockOutput = await executeBedrockConverse({
        messages,
        systemPrompt,
        tools: isDirectChat ? undefined : tools,
        base64ImageUrl,
        executeToolHandler: (fnName, toolArgs) =>
          executeToolHandler(fnName, toolArgs, chatId, user),
        chatId,
      });

      if (bedrockOutput && bedrockOutput.trim().length > 0) {
        return sanitizeOutput(bedrockOutput, displayName);
      }
    } catch (bedrockErr) {
      console.warn(
        "Amazon Bedrock execution error, falling back to Groq:",
        bedrockErr.message
      );
    }
  }

  // 2. Fallback / Alternative: Groq AI engine
  // In groups, casual greetings, or vision requests: execute direct chat without tools
  if (isDirectChat) {
    const directResponse = await executeWithFailover({
      messages,
      model,
      temperature: 0.7,
      max_completion_tokens: base64ImageUrl ? 800 : 1000,
    });
    const rawContent = directResponse.choices[0]?.message?.content || "";
    return sanitizeOutput(rawContent, displayName);
  }

  // Otherwise, use tool calling in private DMs
  try {
    const response = await executeWithFailover({
      messages,
      model,
      temperature: 0.65,
      max_completion_tokens: 1500,
      tools,
      tool_choice: "auto",
    });
    responseMessage = response.choices[0].message;
  } catch (err) {
    console.warn("Tool calling failed, falling back to direct chat:", err.message);
    const fallbackResponse = await executeWithFailover({
      messages,
      model,
      temperature: 0.65,
      max_completion_tokens: 1500,
    });
    responseMessage = fallbackResponse.choices[0].message;
  }

  // Process tool calls if triggered
  if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
    messages.push(responseMessage);

    for (const toolCall of responseMessage.tool_calls) {
      const functionName = toolCall.function.name;
      let args = {};
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        args = {};
      }

      let resultContent = "";
      try {
        resultContent = await executeToolHandler(functionName, args, chatId, user);
      } catch (err) {
        console.error(`Tool execution error [${functionName}]:`, err);
        resultContent = `Error: ${err.message}`;
      }

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        name: functionName,
        content: resultContent,
      });
    }

    try {
      const followUp = await executeWithFailover({
        messages,
        model,
        temperature: 0.65,
        max_completion_tokens: 1500,
      });
      responseMessage = followUp.choices[0].message;
    } catch (err) {
      console.warn("Follow-up error:", err.message);
    }
  }

  const finalRawText = responseMessage?.content || "";
  return sanitizeOutput(finalRawText, displayName);
}

module.exports = { askAI };
