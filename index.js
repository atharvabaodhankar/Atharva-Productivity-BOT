require("dotenv").config();
const { Telegraf } = require("telegraf");
const mongoose = require("mongoose");
const { getTasks } = require("./taskService");
const { askAI } = require("./ai");
const { classifyMemory } = require("./memoryAI");
const Memory = require("./memoryModel");
const { startReminderService } = require("./reminderService");

const bot = new Telegraf(process.env.BOT_TOKEN);

// MongoDB connect
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

// Start command
bot.start((ctx) => {
  ctx.reply("AtharvaOS Activated.\nYour Second Brain is Online.");
});

// List all tasks
bot.command("tasks", async (ctx) => {
  const chatId = ctx.chat.id;
  const tasks = await Memory.find({
    chatId,
    type: { $in: ["task", "assignment", "project"] },
    completed: false,
  }).sort({ date: 1 });

  if (tasks.length === 0) {
    return ctx.reply("✅ No pending tasks!");
  }

  let message = "📌 Your Tasks:\n\n";
  tasks.forEach((t, i) => {
    message += `${i + 1}. ${t.content}\n`;
    if (t.date) {
      message += `   📅 ${new Date(t.date).toDateString()}\n`;
    }
    message += `   ID: ${t._id}\n\n`;
  });

  ctx.reply(message);
});

// List reminders
bot.command("reminders", async (ctx) => {
  const chatId = ctx.chat.id;
  const reminders = await Memory.find({
    chatId,
    type: "reminder",
    completed: false,
  }).sort({ date: 1 });

  if (reminders.length === 0) {
    return ctx.reply("🔔 No active reminders!");
  }

  let message = "🔔 Your Reminders:\n\n";
  reminders.forEach((r, i) => {
    message += `${i + 1}. ${r.content}\n`;
    if (r.date) {
      message += `   ⏰ ${new Date(r.date).toLocaleString()}\n`;
    }
    message += `   ID: ${r._id}\n\n`;
  });

  ctx.reply(message);
});

// List goals
bot.command("goals", async (ctx) => {
  const chatId = ctx.chat.id;
  const goals = await Memory.find({
    chatId,
    type: "goal",
    completed: false,
  });

  if (goals.length === 0) {
    return ctx.reply("🎯 No goals set yet!");
  }

  let message = "🎯 Your Goals:\n\n";
  goals.forEach((g, i) => {
    message += `${i + 1}. ${g.content}\n`;
    if (g.date) {
      message += `   📅 Target: ${new Date(g.date).toDateString()}\n`;
    }
    message += `   ID: ${g._id}\n\n`;
  });

  ctx.reply(message);
});

// Mark task as done
bot.command("done", async (ctx) => {
  const args = ctx.message.text.split(" ");
  if (args.length < 2) {
    return ctx.reply("Usage: /done <task_id>\nGet task ID from /tasks command");
  }

  const taskId = args[1];
  const chatId = ctx.chat.id;

  try {
    const task = await Memory.findOneAndUpdate(
      { _id: taskId, chatId },
      { completed: true },
      { new: true }
    );

    if (task) {
      ctx.reply(`✅ Marked as done: ${task.content}`);
    } else {
      ctx.reply("❌ Task not found or doesn't belong to you");
    }
  } catch (error) {
    ctx.reply("❌ Invalid task ID");
  }
});

// Delete task
bot.command("delete", async (ctx) => {
  const args = ctx.message.text.split(" ");
  if (args.length < 2) {
    return ctx.reply("Usage: /delete <task_id>\nGet task ID from /tasks command");
  }

  const taskId = args[1];
  const chatId = ctx.chat.id;

  try {
    const task = await Memory.findOneAndDelete({ _id: taskId, chatId });

    if (task) {
      ctx.reply(`🗑️ Deleted: ${task.content}`);
    } else {
      ctx.reply("❌ Task not found or doesn't belong to you");
    }
  } catch (error) {
    ctx.reply("❌ Invalid task ID");
  }
});

// Daily summary
bot.command("today", async (ctx) => {
  const chatId = ctx.chat.id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayItems = await Memory.find({
    chatId,
    date: { $gte: today, $lt: tomorrow },
    completed: false,
  });

  const allPending = await Memory.find({
    chatId,
    type: { $in: ["task", "assignment", "project", "exam"] },
    completed: false,
  }).sort({ date: 1 }).limit(5);

  let message = "🌅 Today's Summary\n\n";

  if (todayItems.length > 0) {
    message += "📌 Due Today:\n";
    todayItems.forEach((item) => {
      message += `• ${item.content}\n`;
    });
    message += "\n";
  }

  if (allPending.length > 0) {
    message += "📋 Upcoming Tasks:\n";
    allPending.forEach((item) => {
      message += `• ${item.content}`;
      if (item.date) {
        message += ` (${new Date(item.date).toDateString()})`;
      }
      message += "\n";
    });
  }

  if (todayItems.length === 0 && allPending.length === 0) {
    message += "✨ All clear! No pending tasks.";
  }

  ctx.reply(message);
});

// Help command
bot.command("help", (ctx) => {
  const helpText = `
🤖 AtharvaOS Commands:

📋 Task Management:
/tasks - View all pending tasks
/reminders - View active reminders
/goals - View your goals
/today - Get today's summary
/done <id> - Mark task as complete
/delete <id> - Delete a task/reminder

💬 Natural Language:
Just chat naturally! I'll automatically:
• Store important tasks & reminders
• Remember deadlines
• Provide productivity advice
• Answer your questions

Examples:
"Remind me to call mom in 30 minutes"
"I have a project due next Friday"
"What should I focus on today?"
  `;
  ctx.reply(helpText);
});

// Legacy support for "what are my tasks"
bot.hears(/what are my tasks/i, async (ctx) => {
  ctx.reply("💡 Tip: Use /tasks for a better view!");
  
  const chatId = ctx.chat.id;
  const tasks = await Memory.find({
    chatId,
    type: { $in: ["task", "assignment", "project"] },
    completed: false,
  }).sort({ date: 1 });

  if (tasks.length === 0) {
    return ctx.reply("✅ No pending tasks!");
  }

  let message = "📌 Your Tasks:\n\n";
  tasks.forEach((t, i) => {
    message += `${i + 1}. ${t.content}\n`;
    if (t.date) {
      message += `   📅 ${new Date(t.date).toDateString()}\n`;
    }
    message += "\n";
  });

  ctx.reply(message);
});

// Main message handler
bot.on("text", async (ctx) => {
  try {
    const userMessage = ctx.message.text;
    const chatId = ctx.chat.id; // Get the user's chat ID

    // 1. Classify memory
    const classification = await classifyMemory(userMessage);

    if (classification.store) {
      // Handle array content by converting to JSON string
      const contentToStore = Array.isArray(classification.content)
        ? JSON.stringify(classification.content)
        : classification.content;

      await Memory.create({
        type: classification.type,
        content: contentToStore,
        date: classification.date || null,
        chatId: chatId, // Store the chat ID with the memory
      });
    }

    // 2. AI reply with memory context
    const reply = await askAI(userMessage);

    ctx.reply(reply);
  } catch (error) {
    console.error(error);
    ctx.reply("Something went wrong.");
  }
});

bot.launch();
startReminderService(bot);

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
