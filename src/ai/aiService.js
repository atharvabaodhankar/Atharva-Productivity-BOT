const { executeWithFailover } = require("./groqPool");
const { tools } = require("./tools");
const { buildSystemPrompt } = require("./promptEngine");
const { parseUserDate } = require("../utils/dateHelper");
const Memory = require("../models/Memory");
const User = require("../models/User");

// Clean any leaked XML, function syntax, or internal IDs from raw LLM output
function sanitizeOutput(text) {
  if (!text) return "Chal bhai, sorted! Anything else?";

  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "") // strip reasoning traces
    .replace(/<function=[\s\S]*?<\/function>/gi, "")
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "")
    .replace(/<[\s\S]*?>/g, "") // remove any stray HTML/XML tags
    .replace(/\[ID:\s*[0-9a-fA-F]+\]/g, "")
    .replace(/Pending Tasks Count:\s*\d+/gi, "")
    .replace(/#/g, "")
    .replace(/\*\*/g, "*")
    .trim();
}

const CASUAL_GREETINGS = new Set([
  "hi", "hello", "hey", "yo", "ho", "haan", "ha", "ok", "okay",
  "kya hal", "kya chal raha", "sup", "wassup", "good morning", "good night", "bye",
  "kesa he bro", "kaisa hai bro", "kaisa he", "who made you"
]);

async function askAI({
  message,
  chatId,
  historyContext = "",
  base64ImageUrl = null,
  isGroup = false,
  senderName = "Friend",
}) {
  const user = await User.findOne({ telegramId: chatId });
  const memories = isGroup
    ? []
    : await Memory.find({ chatId })
        .sort({ completed: 1, createdAt: -1 })
        .limit(20);

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

  const model = base64ImageUrl
    ? "qwen/qwen3.6-27b"
    : "llama-3.3-70b-versatile";

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
  const isCasualChat = (CASUAL_GREETINGS.has(cleanInput) || isGroup) && !base64ImageUrl;

  let responseMessage;

  // In groups or casual greetings, execute direct chat without tools to prevent workspace leaks/hallucinations
  if (isCasualChat) {
    const directResponse = await executeWithFailover({
      messages,
      model,
      temperature: 0.7,
      max_completion_tokens: 350,
    });
    const rawContent =
      directResponse.choices[0].message.content || directResponse.choices[0].message.reasoning || "";
    return sanitizeOutput(rawContent);
  }

  // Otherwise, use tool calling in private DMs
  try {
    const response = await executeWithFailover({
      messages,
      model,
      temperature: 0.65,
      max_completion_tokens: 600,
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
      max_completion_tokens: 500,
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
        if (functionName === "add_memory") {
          const parsedDate = parseUserDate(args.date, user ? user.timezone : "Asia/Kolkata");
          let parentProjectId = null;
          let parentProjectName = "";

          if (args.projectName && args.type !== "project") {
            const trimmedName = args.projectName.trim();
            // Find existing project (case-insensitive)
            let existingProj = await Memory.findOne({
              chatId,
              type: "project",
              content: new RegExp(`^${trimmedName}$`, "i"),
            });

            if (!existingProj) {
              // Partial search match
              existingProj = await Memory.findOne({
                chatId,
                type: "project",
                content: new RegExp(trimmedName, "i"),
              });
            }

            if (!existingProj) {
              // Automatically create the project container
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

          const newMem = await Memory.create({
            chatId,
            type: args.type || "task",
            content: args.content,
            url: args.url || "",
            date: parsedDate,
            priority: args.priority || "medium",
            tags: args.tags || [],
            projectId: parentProjectId,
            projectName: parentProjectName,
          });

          const parentNote = parentProjectName ? ` (inside project "${parentProjectName}")` : "";
          resultContent = `Successfully created ${newMem.type}: "${newMem.content}"${parentNote} (ID: ${newMem._id})`;
        } else if (functionName === "complete_memory") {
          const updated = await Memory.findOneAndUpdate(
            { _id: args.id, chatId },
            { completed: true },
            { new: true }
          );
          resultContent = updated
            ? `Marked "${updated.content}" as COMPLETED.`
            : `Item not found.`;
        } else if (functionName === "delete_memory") {
          const deleted = await Memory.findOneAndDelete({ _id: args.id, chatId });
          resultContent = deleted
            ? `Deleted item "${deleted.content}".`
            : `Item not found.`;
        } else if (functionName === "clear_all_memories") {
          const res = await Memory.deleteMany({ chatId });
          resultContent = `Cleared all ${res.deletedCount} items.`;
        }
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
      });
      responseMessage = followUp.choices[0].message;
    } catch (err) {
      console.warn("Follow-up error:", err.message);
    }
  }

  const finalRawText = responseMessage.content || responseMessage.reasoning || "";
  return sanitizeOutput(finalRawText);
}

module.exports = { askAI };
