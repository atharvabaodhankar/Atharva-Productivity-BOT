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
            enum: [
              "task",
              "assignment",
              "exam",
              "project",
              "goal",
              "idea",
              "reminder",
              "note",
              "reflection",
              "video",
              "link",
            ],
            description: "The category of item to store.",
          },
          content: {
            type: "string",
            description: "The clear title or actionable description of the item.",
          },
          url: {
            type: "string",
            description: "Optional web URL or video link (e.g. YouTube, Loom, GitHub, Drive, article link) to bookmark.",
          },
          date: {
            type: "string",
            description: "Optional ISO-8601 date string for deadlines or reminder times.",
          },
          priority: {
            type: "string",
            enum: ["high", "medium", "low"],
            description: "Priority of the task (default: medium).",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Optional list of tags e.g. ['work', 'study', 'dsa'].",
          },
          projectName: {
            type: "string",
            description: "The name of the parent project this task belongs to (e.g. 'Blockchain Land Registry' or 'Schedule'). If specified, the task will be nested inside this project.",
          },
        },
        required: ["type", "content"],
      },
    },
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
            description: "The MongoDB document ID of the task to mark completed.",
          },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_memory",
      description: "Permanently delete/remove a specific task, reminder, or note by its ID.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "The MongoDB document ID of the memory to delete.",
          },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "clear_all_memories",
      description: "Delete ALL tasks, reminders, notes, and goals for this specific user.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
];

module.exports = { tools };
