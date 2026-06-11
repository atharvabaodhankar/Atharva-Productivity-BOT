require("dotenv").config();
const Groq = require("groq-sdk");
const Memory = require("./memoryModel");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const tools = [
  {
    type: "function",
    function: {
      name: "add_memory",
      description: "Create a new task, assignment, exam, project, goal, idea, reminder, note, or reflection for the user.",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["task", "assignment", "exam", "project", "goal", "idea", "reminder", "note", "reflection"],
            description: "The type of memory/item to store."
          },
          content: {
            type: "string",
            description: "The text content of the item."
          },
          date: {
            type: "string",
            description: "Optional ISO-8601 date string associated with the item (e.g. deadline or reminder time)."
          }
        },
        required: ["type", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "complete_memory",
      description: "Mark a task, assignment, exam, or project as completed by its ID.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "The MongoDB document ID of the memory/task to mark as complete."
          }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_memory",
      description: "Delete/remove a specific memory, task, or note by its ID.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "The MongoDB document ID of the memory/task to delete."
          }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "clear_all_memories",
      description: "Delete all memories, tasks, reminders, notes, and goals for the user, wiping their slate clean.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  }
];

async function askAI(message, chatId, history = "", base64ImageUrl = null) {
  // Fetch memories to put in context
  const memories = await Memory.find({ chatId })
    .sort({ completed: 1, createdAt: -1 })
    .limit(30);

  const memoryText = memories
    .map(m => `- [${m.completed ? "DONE" : "PENDING"}] (${m.type}) ${m.content} [ID: ${m._id}] ${m.date ? "on " + m.date.toDateString() : ""}`)
    .join("\n");

  const pendingTasks = await Memory.countDocuments({ 
    chatId, 
    type: { $in: ["task", "assignment", "project"] },
    completed: false 
  });

  const systemPrompt = `
You are AtharvaOS - a hilarious, energetic productivity buddy with a desi sense of humor!

PERSONALITY:
- You're like that friend who roasts you but has your back 100%
- Use Hindi/English mix (Hinglish) occasionally - "bhai", "yaar", "chal", "arre", "kya baat hai"
- Crack jokes, use emojis, be playful but NEVER lose focus on productivity
- Roast gently when they procrastinate
- Hype them up when they're working hard

CONVERSATION HISTORY:
${history || "(No recent conversation history)"}

USER'S CURRENT MEMORY (Tasks, Notes, etc.):
${memoryText || "(Empty - no tasks or notes stored yet!)"}

Pending Tasks Count: ${pendingTasks}

CRITICAL INSTRUCTIONS FOR TOOLS:
- You have direct tools to add, complete, delete, or clear memories in MongoDB.
- You can also view images (e.g. photos of handwritten checklists, screenshots) that the user uploads. Analyze the image and extract tasks, goals, or reminders.
- When the user asks to add/create a task, reminder, note, goal, etc. (either in text or from the uploaded image), call the 'add_memory' tool.
- When the user asks to complete, check off, or mark a task as done, call the 'complete_memory' tool. Make sure to find the correct ID from the memory list provided above.
- When the user asks to delete or remove a task, call the 'delete_memory' tool.
- When the user asks to clear all, wipe everything, delete all tasks, etc., call the 'clear_all_memories' tool.
- Always perform the appropriate tool call first, and then confirm to the user in your Hinglish persona that the action was successfully performed in the database.
- If the user specifies a relative date/time (e.g. "tomorrow", "next Friday", "in 30 minutes"), parse it relative to the current local time: ${new Date().toString()}.
`;

  const model = base64ImageUrl ? "llama-3.2-11b-vision-preview" : "llama-3.3-70b-versatile";
  const textPrompt = message || (base64ImageUrl ? "Analyze this image and perform necessary actions." : "");

  let userContent = textPrompt;
  if (base64ImageUrl) {
    userContent = [
      { type: "text", text: textPrompt },
      {
        type: "image_url",
        image_url: {
          url: base64ImageUrl
        }
      }
    ];
  }

  const messages = [
    {
      role: "system",
      content: systemPrompt
    },
    {
      role: "user",
      content: userContent
    }
  ];

  let response = await groq.chat.completions.create({
    messages: messages,
    model: model,
    temperature: 0.9,
    max_completion_tokens: 800,
    tools: tools,
    tool_choice: "auto"
  });

  let responseMessage = response.choices[0].message;

  if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
    messages.push(responseMessage);

    for (const toolCall of responseMessage.tool_calls) {
      const functionName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments);
      let resultContent = "";

      try {
        if (functionName === "add_memory") {
          const newMem = await Memory.create({
            type: args.type,
            content: args.content,
            date: args.date ? new Date(args.date) : null,
            chatId: chatId
          });
          resultContent = `Successfully created memory: "${newMem.content}" of type: ${newMem.type} with ID: ${newMem._id}`;
        } else if (functionName === "complete_memory") {
          const updated = await Memory.findOneAndUpdate(
            { _id: args.id, chatId },
            { completed: true },
            { new: true }
          );
          resultContent = updated 
            ? `Successfully marked task "${updated.content}" (ID: ${args.id}) as completed` 
            : `Memory ID ${args.id} not found or does not belong to you`;
        } else if (functionName === "delete_memory") {
          const deleted = await Memory.findOneAndDelete({ _id: args.id, chatId });
          resultContent = deleted 
            ? `Successfully deleted task "${deleted.content}" (ID: ${args.id})` 
            : `Memory ID ${args.id} not found or does not belong to you`;
        } else if (functionName === "clear_all_memories") {
          const deletedResult = await Memory.deleteMany({ chatId });
          resultContent = `Successfully cleared all ${deletedResult.deletedCount} memories for this user.`;
        }
      } catch (err) {
        console.error(`Error executing tool ${functionName}:`, err);
        resultContent = `Error executing tool: ${err.message}`;
      }

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        name: functionName,
        content: resultContent
      });
    }

    // Call Groq again for final conversation
    const secondResponse = await groq.chat.completions.create({
      messages: messages,
      model: model
    });
    responseMessage = secondResponse.choices[0].message;
  }

  return responseMessage.content
    .replace(/#/g, "")
    .replace(/\*\*/g, "*");
}

module.exports = { askAI };