const { executeWithFailover } = require("./groqPool");
const { tools } = require("./tools");
const { buildSystemPrompt } = require("./promptEngine");
const Memory = require("../models/Memory");
const User = require("../models/User");

async function askAI({ message, chatId, historyContext = "", base64ImageUrl = null }) {
  const user = await User.findOne({ telegramId: chatId });
  const memories = await Memory.find({ chatId })
    .sort({ completed: 1, createdAt: -1 })
    .limit(25);

  const pendingTasksCount = await Memory.countDocuments({
    chatId,
    type: { $in: ["task", "assignment", "project", "exam"] },
    completed: false,
  });

  const systemPrompt = buildSystemPrompt({
    user,
    memories,
    pendingTasksCount,
    historyText: historyContext,
  });

  const model = base64ImageUrl
    ? "llama-3.2-11b-vision-preview"
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

  let response = await executeWithFailover({
    messages,
    model,
    temperature: 0.85,
    max_completion_tokens: 800,
    tools,
    tool_choice: "auto",
  });

  let responseMessage = response.choices[0].message;

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
          const newMem = await Memory.create({
            chatId,
            type: args.type,
            content: args.content,
            date: args.date ? new Date(args.date) : null,
            priority: args.priority || "medium",
            tags: args.tags || [],
          });
          resultContent = `Successfully created ${newMem.type}: "${newMem.content}" (ID: ${newMem._id})`;
        } else if (functionName === "complete_memory") {
          const updated = await Memory.findOneAndUpdate(
            { _id: args.id, chatId },
            { completed: true },
            { new: true }
          );
          resultContent = updated
            ? `Marked task "${updated.content}" as complete.`
            : `Task ID ${args.id} not found.`;
        } else if (functionName === "delete_memory") {
          const deleted = await Memory.findOneAndDelete({ _id: args.id, chatId });
          resultContent = deleted
            ? `Deleted item "${deleted.content}".`
            : `Item ID ${args.id} not found.`;
        } else if (functionName === "clear_all_memories") {
          const res = await Memory.deleteMany({ chatId });
          resultContent = `Cleared ${res.deletedCount} items. Slate is clean.`;
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

    const followUp = await executeWithFailover({
      messages,
      model,
    });
    responseMessage = followUp.choices[0].message;
  }

  return responseMessage.content
    ? responseMessage.content.replace(/#/g, "").replace(/\*\*/g, "*")
    : "Chal bhai, sorted! Anything else?";
}

module.exports = { askAI };
