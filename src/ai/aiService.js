const { executeWithFailover } = require("./groqPool");
const { tools } = require("./tools");
const { buildSystemPrompt } = require("./promptEngine");
const { parseUserDate } = require("../utils/dateHelper");
const Memory = require("../models/Memory");
const User = require("../models/User");

// Clean any leaked XML, function syntax, reasoning traces, or internal IDs from raw LLM output
function sanitizeOutput(text) {
  if (!text) return "Chal bhai, sorted! Anything else?";

  let cleaned = String(text)
    .replace(/<think>[\s\S]*?<\/think>/gi, "") // strip reasoning traces
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
    .replace(/<function=[\s\S]*?<\/function>/gi, "")
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "")
    .replace(/<[\s\S]*?>/g, "") // remove any stray HTML/XML tags
    .replace(/\[ID:\s*[0-9a-fA-F]+\]/g, "")
    .replace(/Pending Tasks Count:\s*\d+/gi, "")
    .replace(/#/g, "")
    .replace(/\*\*/g, "*")
    .trim();

  // If the model leaked reasoning with "Assistant response:", "Draft:", or quotes, extract the actual spoken response:
  const assistantMatch = cleaned.match(/(?:Assistant response|Draft|Final Polish):\s*["']?([\s\S]+?)["']?$/i);
  if (assistantMatch && assistantMatch[1]) {
    cleaned = assistantMatch[1].trim();
  }

  // Detect and purge any unformatted raw thought lines
  const reasoningStarters = /^(Looking at the workspace|The user |I need to |Let's |Tool call:|Current time:|Parameters:|- type:|- content:|- isRecurring:|- recurrenceInterval:|- timeOfDay:|- date:|Since there are duplicates|I should probably|The first one|Wait,|Actually,|I will mark|I will call|It matches|I will proceed|I'll complete|Plan:|Draft:|Interpretation|Final Polish:)/i;

  if (reasoningStarters.test(cleaned)) {
    const lines = cleaned.split("\n").map((l) => l.trim()).filter(Boolean);
    const validLines = lines.filter((l) => !reasoningStarters.test(l) && !/^[0-9]+\.\s*[0-9a-fA-F]{10,}/.test(l));
    if (validLines.length > 0) {
      cleaned = validLines.join("\n\n");
    } else {
      cleaned = "Done bhai! Maine tasks update kar diye hain! 🔥";
    }
  }

  return cleaned || "Sorted bhai! Anything else?";
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

  const model = "llama-3.3-70b-versatile";

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
            const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            // Find existing project (case-insensitive)
            let existingProj = await Memory.findOne({
              chatId,
              type: "project",
              content: new RegExp(`^${escapedName}$`, "i"),
            });

            if (!existingProj) {
              // Partial search match
              existingProj = await Memory.findOne({
                chatId,
                type: "project",
                content: new RegExp(escapedName, "i"),
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

          const isRecurring = Boolean(args.isRecurring || args.recurrenceInterval);
          const recurrenceInterval = args.recurrenceInterval || (isRecurring ? "daily" : "");
          const timeOfDay = args.timeOfDay || "";

          let effectiveDate = parsedDate;
          if (isRecurring && parsedDate && parsedDate <= new Date()) {
            // If recurring reminder target is in the past today, advance by 1 day
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
