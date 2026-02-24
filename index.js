require("dotenv").config();
const { Telegraf } = require("telegraf");
const mongoose = require("mongoose");
const { getTasks } = require("./taskService");
const { askAI } = require("./ai");
const { classifyMemory } = require("./memoryAI");
const Memory = require("./memoryModel");
const History = require("./historyModel");
const { startReminderService } = require("./reminderService");

const bot = new Telegraf(process.env.BOT_TOKEN);

// MongoDB connect
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

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
🤖 AtharvaOS - Your Energetic Productivity Buddy!

📋 Commands:
/tasks - Check what's pending (with spicy deadlines 🔥)
/reminders - Your active reminders
/goals - See your goals
/today - Today's game plan
/reflections - Your growth log (Last 7 days) 📒
/done <id> - Mark task complete (celebrate! 🎉)
/delete <id> - Delete a task
/motivate - Need a boost? Get hyped! 💪
/roast - Get roasted (lovingly 😂)
/help - This menu

💬 Just Chat Naturally!
I'll automatically remember:
• Tasks & deadlines
• Reminders
• Goals & ideas
• Important stuff

Examples:
"Remind me to call mom in 30 minutes"
"I have a project due next Friday"
"What should I work on?"
"I'm feeling lazy" (I'll roast you 😏)

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

    // 1. Classify memory with context
    const classification = await classifyMemory(userMessage, historyContext);

    if (classification.store) {
      const contentToStore = Array.isArray(classification.content)
        ? JSON.stringify(classification.content)
        : classification.content;

      await Memory.create({
        type: classification.type,
        content: contentToStore,
        date: classification.date || null,
        chatId: chatId,
      });
    }

    // 2. AI reply with memory context and history
    const reply = await askAI(userMessage, chatId, historyContext);

    // 3. Store conversation history
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

bot.launch();
startReminderService(bot);

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
