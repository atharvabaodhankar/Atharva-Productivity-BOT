require("dotenv").config();
const { Telegraf } = require("telegraf");
const mongoose = require("mongoose");
const { getTasks } = require("./taskService");
const { askAI } = require("./ai");
const Memory = require("./memoryModel");
const History = require("./historyModel");
const { startReminderService } = require("./reminderService");

const bot = new Telegraf(process.env.BOT_TOKEN);

// Access control middleware
bot.use((ctx, next) => {
  if (ctx.chat && String(ctx.chat.id) !== process.env.CHAT_ID) {
    return ctx.reply("its atharva's personal bot contact atharva to use it");
  }
  return next();
});

// MongoDB connect
const PORT = process.env.PORT || 3000;

async function startApp() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected Successfully");

    // Start bot
    if (process.env.WEBHOOK_DOMAIN) {
      bot.launch({
        webhook: {
          domain: process.env.WEBHOOK_DOMAIN, // your-app.onrender.com
          port: PORT,
          host: "0.0.0.0" // Bind to all interfaces so Render's port scan succeeds
        }
      });
      console.log("Telegram Bot Launched in Webhook Mode");
    } else {
      bot.launch();
      console.log("Telegram Bot Launched in Polling Mode (WEBHOOK_DOMAIN not set)");
    }

    // Start reminder service
    startReminderService(bot);

  } catch (err) {
    console.error("FAILED to start application:");
    console.error(err);
    process.exit(1);
  }
}

startApp();

// Start command
bot.start((ctx) => {
  const funGreetings = [
    "Yo yo yo! AtharvaOS is LIVE! 🚀\nReady to crush some goals today? Let's goooo! 💪",
    "Arre bhai! Your productivity buddy is here! 🔥\nBata kya karna hai aaj? Let's make it happen! 💯",
    "LESSGOOO! 🎯 AtharvaOS activated!\nTime to turn those dreams into reality, champ! ⚡",
    "Ayeee! What's good? 😎\nYour second brain is online and ready to help you dominate! 🏆"
  ];
  
  const greeting = funGreetings[Math.floor(Math.random() * funGreetings.length)];
  ctx.reply(greeting);
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
    const funMessages = [
      "Woohoo! 🎉 No pending tasks! You're a productivity BEAST! Time to chill or set new goals? 😎",
      "Arre wah! All clear! 🌟 Kya baat hai! Now go enjoy or plan something epic! 🚀",
      "YOOO! Task list = EMPTY! 💯 You're crushing it! Time for some well-deserved fun! 🎮"
    ];
    return ctx.reply(funMessages[Math.floor(Math.random() * funMessages.length)]);
  }

  let message = "📌 Alright boss, here's what's pending:\n\n";
  tasks.forEach((t, i) => {
    message += `${i + 1}. ${t.content}\n`;
    if (t.date) {
      const daysLeft = Math.ceil((new Date(t.date) - new Date()) / (1000 * 60 * 60 * 24));
      message += `   📅 ${new Date(t.date).toDateString()}`;
      if (daysLeft < 0) {
        message += ` ⚠️ OVERDUE! Bhai kya kar raha hai? 😅`;
      } else if (daysLeft === 0) {
        message += ` 🔥 DUE TODAY! Let's gooo!`;
      } else if (daysLeft <= 2) {
        message += ` ⏰ ${daysLeft} days left! Hurry up!`;
      }
      message += "\n";
    }
    message += `   ID: ${t._id}\n\n`;
  });

  if (tasks.length > 3) {
    message += "\n💪 That's a lot! But you got this, champ! One task at a time! 🔥";
  } else {
    message += "\n🎯 Looking good! Finish these and you're golden! ✨";
  }

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
    return ctx.reply("Arre bhai! Usage: /done <task_id>\nGet task ID from /tasks command 😊");
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
      const celebrations = [
        `🎉 BOOM! Task completed: ${task.content}\n\nYou're on FIRE today! 🔥 Keep going, champion! 💪`,
        `✅ LESSGOOO! ${task.content} ✓\n\nKya baat hai! One down, let's crush the rest! 🚀`,
        `🏆 YESSS! ${task.content} - DONE!\n\nYou're unstoppable! This is what I'm talking about! 💯`,
        `⚡ SHABASH! ${task.content} complete!\n\nMomentum building! Don't stop now! 🎯`
      ];
      ctx.reply(celebrations[Math.floor(Math.random() * celebrations.length)]);
    } else {
      ctx.reply("Hmm... Task not found yaar 🤔 Check the ID with /tasks");
    }
  } catch (error) {
    ctx.reply("Oops! Invalid task ID bro 😅 Use /tasks to get the right one");
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

// List reflections
bot.command("reflections", async (ctx) => {
  const chatId = ctx.chat.id;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const reflections = await Memory.find({
    chatId,
    type: "reflection",
    createdAt: { $gte: sevenDaysAgo },
  }).sort({ createdAt: -1 });

  if (reflections.length === 0) {
    return ctx.reply("📒 No reflections yet! Wait for the 10 PM prompt or just tell me what you achieved today!");
  }

  let message = "📒 Your Recent Growth (Last 7 Days):\n\n";
  reflections.forEach((r) => {
    message += `📅 ${new Date(r.createdAt).toDateString()}\n`;
    message += `✨ ${r.content}\n\n`;
  });

  message += "Keep ukhad-ing stuff, champ! 🚀";
  ctx.reply(message);
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

  const hour = new Date().getHours();
  let greeting = "🌅 Good Morning";
  if (hour >= 12 && hour < 17) greeting = "☀️ Good Afternoon";
  if (hour >= 17 && hour < 21) greeting = "🌆 Good Evening";
  if (hour >= 21 || hour < 5) greeting = "🌙 Still Awake";

  let message = `${greeting}, champ! Here's the deal:\n\n`;

  if (todayItems.length > 0) {
    message += "� DUE TODAY (Get on it!):\n";
    todayItems.forEach((item) => {
      message += `• ${item.content}\n`;
    });
    message += "\n";
  }

  if (allPending.length > 0) {
    message += "📋 Coming Up:\n";
    allPending.forEach((item) => {
      message += `• ${item.content}`;
      if (item.date) {
        message += ` (${new Date(item.date).toDateString()})`;
      }
      message += "\n";
    });
  }

  if (todayItems.length === 0 && allPending.length === 0) {
    message += "✨ All clear! No pending tasks!\n\nTime to set new goals or just vibe! 😎🎮";
  } else if (todayItems.length > 0) {
    message += "\n💪 Chal bhai, let's knock these out! You got this! 🚀";
  } else {
    message += "\n🎯 Looking solid! Stay ahead of the game! 💯";
  }

  ctx.reply(message);
});

// Help command
bot.command("help", (ctx) => {
  const helpText = `
🤖 AtharvaOS - Your AI Productivity Buddy!
Now equipped with direct database control & Vision!

💬 What you can ask the AI to do (Natural Chat):
• Read Images: Send a photo/screenshot (e.g. todo checklist, notes) and say "Add these tasks"
• Add Tasks & Deadlines: "I have a DSA exam next Monday", "Add project task"
• Set Reminders: "Remind me to call mom in 30 minutes"
• Save Goals & Ideas: "Set a goal to run 5km every day"
• Mark Completed: "Mark task 6a2a396032f1b5... as done" or "I finished my DSA study"
• Delete Tasks: "Delete my study task" or "Delete task 6a2a396032f1b5..."
• Clear All Data: "clear all", "wipe everything" to start fresh!
• Talk & Vibe: Ask for a roast ("roast me"), get hyped ("motivate me"), or just chat!

📋 Quick Slash Commands:
/tasks - List all pending tasks with deadline alerts 🔥
/reminders - View your active reminders 🔔
/goals - View your current goals 🎯
/today - Get your daily game plan 🌅
/reflections - View your growth log from the last 7 days 📒
/done <id> - Mark a task as done (triggers celebration!)
/delete <id> - Delete a task
/motivate - Get a sudden shot of hype 💪
/roast - Get a friendly Hinglish roast 😂
/help - Show this menu

Let's crush those goals together! 🚀
  `;
  ctx.reply(helpText);
});

// Motivational boost
bot.command("motivate", (ctx) => {
  const motivations = [
    "🔥 YOU ARE A MACHINE! Nothing can stop you today! Let's GOOO! 💪",
    "⚡ Bhai, you're literally ONE task away from being unstoppable! DO IT! 🚀",
    "💯 Remember why you started! You got dreams to chase! Let's make it happen! 🎯",
    "🏆 Champions aren't born, they're made! And you're making yourself one RIGHT NOW! 💪",
    "🌟 Arre yaar, you've come so far! Don't stop now! Keep pushing! 🔥",
    "⚡ Your future self is watching! Make them PROUD! Let's crush it! 💪",
    "🚀 Small steps, BIG dreams! You're doing amazing! Keep going! 🌟",
    "💪 Tough times don't last, tough people do! And you're TOUGH! Let's go! 🔥"
  ];
  ctx.reply(motivations[Math.floor(Math.random() * motivations.length)]);
});

// Roast command (playful)
bot.command("roast", async (ctx) => {
  const chatId = ctx.chat.id;
  const pendingCount = await Memory.countDocuments({
    chatId,
    type: { $in: ["task", "assignment", "project"] },
    completed: false,
  });

  const roasts = [
    `Bhai ${pendingCount} tasks pending hain aur tu roast maang raha hai? 😂 Priorities set kar pehle! 📚`,
    "Arre yaar, Netflix pe PhD kar raha hai kya? 😅 Chal laptop khol aur kuch productive kar! 💻",
    "Procrastination level: EXPERT 😂 But seriously, let's get to work! Time's ticking! ⏰",
    `${pendingCount} tasks pending... bhai tu toh legend hai! Ab legendary work bhi dikha de! 💪😂`,
    "Instagram reels dekh ke degree nahi milegi bro 😂 Chal focus mode ON kar! 🎯",
    "Arre champion, roast se zyada task complete kar! That's the real flex! 💯😎"
  ];
  
  if (pendingCount === 0) {
    ctx.reply("Roast? Bhai tu toh already crushing it! 🔥 All tasks done! I'm proud of you! 🎉");
  } else {
    ctx.reply(roasts[Math.floor(Math.random() * roasts.length)]);
  }
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
    const chatId = ctx.chat.id;

    // Fetch recent history for context (last 5 messages)
    const history = await History.find({ chatId }).sort({ createdAt: -1 }).limit(5);
    const historyContext = history.reverse().map(h => `${h.role}: ${h.content}`).join("\n");

    // Call askAI directly (database queries, creations, edits, and clears are handled internally via tool calling)
    const reply = await askAI(userMessage, chatId, historyContext);

    // Store conversation history
    await History.create([
      { chatId, role: "user", content: userMessage },
      { chatId, role: "assistant", content: reply }
    ]);

    ctx.reply(reply);
  } catch (error) {
    console.error(error);
    ctx.reply("Something went wrong.");
  }
});

// Main photo handler (Vision Support)
bot.on("photo", async (ctx) => {
  try {
    const chatId = ctx.chat.id;
    const caption = ctx.message.caption || "";
    
    // Get the largest photo size
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const fileId = photo.file_id;

    ctx.reply("Reading your image, please wait... 🔎👀");

    // Get file download link
    const fileLink = await ctx.telegram.getFileLink(fileId);

    // Download file and convert to base64
    const response = await fetch(fileLink.href);
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const base64ImageUrl = `data:image/jpeg;base64,${base64}`;

    // Fetch recent history for context (last 5 messages)
    const history = await History.find({ chatId }).sort({ createdAt: -1 }).limit(5);
    const historyContext = history.reverse().map(h => `${h.role}: ${h.content}`).join("\n");

    // Call askAI with image URL
    const reply = await askAI(caption, chatId, historyContext, base64ImageUrl);

    // Store conversation history
    await History.create([
      { chatId, role: "user", content: caption ? `[Photo] ${caption}` : "[Photo]" },
      { chatId, role: "assistant", content: reply }
    ]);

    ctx.reply(reply);
  } catch (error) {
    console.error("Error in photo handler:", error);
    ctx.reply("Arre yaar, I failed to process that image! 😅 Make sure it's not too large.");
  }
});

// Stop services gracefully
process.once("SIGINT", () => {
  bot.stop("SIGINT");
  process.exit(0);
});
process.once("SIGTERM", () => {
  bot.stop("SIGTERM");
  process.exit(0);
});
