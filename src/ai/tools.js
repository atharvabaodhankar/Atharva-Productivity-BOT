const tools = [
  {
    type: "function",
    function: {
      name: "add_memory",
      description: "Create a new task, assignment, exam, project, goal, idea, reminder, note, or reflection. CRITICAL: Use ONLY when user EXPLICITLY asks to add, record, save, track, or schedule something. NEVER call this tool for questions, coding help, brainstorming, casual conversation, or when the user expresses negative intent (e.g. 'no projects', 'wait', 'don't add').",
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
          isRecurring: {
            type: "boolean",
            description: "Set to true if this is a recurring/repeated reminder (e.g. daily, everyday, every morning, weekly).",
          },
          recurrenceInterval: {
            type: "string",
            enum: ["daily", "weekdays", "weekly", "monthly"],
            description: "The frequency of recurrence: 'daily' for daily/everyday reminders, 'weekdays' for Mon-Fri, 'weekly' for once a week, 'monthly' for once a month.",
          },
          timeOfDay: {
            type: "string",
            description: "The time of day in 24-hour HH:MM format (e.g. '08:00', '20:00', '14:30') when this recurring reminder should trigger.",
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
      name: "delete_reminder",
      description: "Delete or cancel one, specific, or all reminders for the user. Use this whenever the user asks to delete, cancel, stop, or clear reminders (e.g. 'delete my reminder', 'cancel gym reminder', 'delete all reminders').",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Optional MongoDB document ID of the specific reminder to delete.",
          },
          query: {
            type: "string",
            description: "Optional title, keyword, or text to match reminder content (e.g. 'water', 'gym', 'meeting').",
          },
          deleteAll: {
            type: "boolean",
            description: "Set to true if user wants to delete, cancel, or clear ALL reminders.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_memory",
      description: "Permanently delete/remove a specific task, reminder, or note by its ID or title keyword.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Optional MongoDB document ID of the item to delete.",
          },
          query: {
            type: "string",
            description: "Optional content, title, or keyword to match if ID is not known.",
          },
        },
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
  {
    type: "function",
    function: {
      name: "toggle_daily_briefings",
      description: "Enable or disable automated daily messages such as 8:00 AM Morning Game Plan / Briefing, 10:00 PM Nightly Reflection / Check-in, or all automated daily reminders. Use this whenever the user asks to stop, turn off, disable, mute, start, or enable morning messages, nightly check-ins, or daily routine reminders.",
      parameters: {
        type: "object",
        properties: {
          morningSummaryEnabled: {
            type: "boolean",
            description: "Set to false to stop/disable 8 AM morning summary, true to enable.",
          },
          nightlyReflectionEnabled: {
            type: "boolean",
            description: "Set to false to stop/disable 10 PM night reflection, true to enable.",
          },
          dailyRemindersEnabled: {
            type: "boolean",
            description: "Set to false to mute/disable all automated daily messages, true to enable.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "spendwise_add_transaction",
      description: "Log an expense or income transaction in SpendWise. Automatically adjusts online (UPI/Bank) or cash balance and updates monthly budget tracking.",
      parameters: {
        type: "object",
        properties: {
          amount: {
            type: "number",
            description: "The amount of money (e.g. 250, 1500.50).",
          },
          type: {
            type: "string",
            enum: ["expense", "income"],
            description: "Type: 'expense' for money spent, 'income' for earnings/money received (default: expense).",
          },
          category: {
            type: "string",
            description: "Category (e.g. Food & Dining, Shopping, Transport, Entertainment, Bills & Utilities, Groceries, Health, Freelance, Salary, Other).",
          },
          paymentMethod: {
            type: "string",
            enum: ["online", "cash"],
            description: "Payment method: 'online' for UPI, card, netbanking; 'cash' for physical cash (default: online).",
          },
          description: {
            type: "string",
            description: "Short note, merchant name, or reason (e.g. 'Starbucks coffee', 'Freelance payment').",
          },
          date: {
            type: "string",
            description: "Optional ISO date in YYYY-MM-DD format (defaults to today).",
          },
        },
        required: ["amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "spendwise_get_summary",
      description: "Get real-time financial summary from SpendWise: current online balance, cash balance, total spending this month, and budget progress.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "spendwise_list_transactions",
      description: "Filter and view recent transactions in SpendWise.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of transactions to return (default: 5, max: 20).",
          },
          category: {
            type: "string",
            description: "Filter by category name (e.g. 'Food', 'Transport').",
          },
          type: {
            type: "string",
            enum: ["expense", "income"],
            description: "Filter by expense or income.",
          },
          search: {
            type: "string",
            description: "Filter by merchant name or keyword in description.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "spendwise_split_expense",
      description: "Split a bill with friends in SpendWise: records your share and creates debt records for friends.",
      parameters: {
        type: "object",
        properties: {
          totalAmount: {
            type: "number",
            description: "Total bill amount paid.",
          },
          description: {
            type: "string",
            description: "Description of the split (e.g. 'Dinner at Olive Garden').",
          },
          friendEmails: {
            type: "array",
            items: { type: "string" },
            description: "List of friend email addresses splitting the bill.",
          },
          paymentMethod: {
            type: "string",
            enum: ["online", "cash"],
            description: "Payment method used (default: online).",
          },
          category: {
            type: "string",
            description: "Category for the bill (default: 'Food & Dining').",
          },
        },
        required: ["totalAmount", "description", "friendEmails"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "spendwise_get_debts",
      description: "View active bill split debts: see who owes you money and who you owe money to in SpendWise.",
      parameters: {
        type: "object",
        properties: {
          filter: {
            type: "string",
            enum: ["all", "you_owe", "owed_to_you"],
            description: "Filter debts: 'all', 'you_owe', or 'owed_to_you' (default: all).",
          },
        },
      },
    },
  },
];

function getToolsForUser(user) {
  const hasSpendWise = Boolean(user && user.spendwiseApiKey);
  if (!hasSpendWise) {
    // Return standard productivity tools (exclude spendwise tools so LLM does not call them without a key)
    return tools.filter((t) => !t.function.name.startsWith("spendwise_"));
  }
  return tools;
}

module.exports = { tools, getToolsForUser };

