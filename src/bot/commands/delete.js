const { deleteMemory, getReminders, getPendingTasks } = require("../../services/memoryService");
const { privateOnly } = require("../middlewares/privateOnly");
const Memory = require("../../models/Memory");

module.exports = (bot) => {
  bot.command(["delete", "deletereminder", "clearreminders"], privateOnly(async (ctx) => {
    const text = (ctx.message.text || "").trim();
    const parts = text.split(/\s+/);
    const command = parts[0].toLowerCase();
    const chatId = ctx.chat.id;

    // Direct /clearreminders command
    if (command.includes("clearreminders")) {
      const res = await Memory.deleteMany({ chatId, type: "reminder" });
      return ctx.reply(`🗑️ Cleared all ${res.deletedCount} reminders! ✨`);
    }

    if (parts.length < 2) {
      // User called /delete without arguments: show interactive list
      const reminders = await getReminders(chatId);
      const tasks = await getPendingTasks(chatId);

      if (reminders.length === 0 && tasks.length === 0) {
        return ctx.reply("ℹ️ You have no active reminders or pending tasks to delete!");
      }

      let replyMsg = "🗑️ <b>Tap an item below to delete it:</b>\n\n";
      const inlineKeyboard = [];

      if (reminders.length > 0) {
        replyMsg += "<b>⏰ Active Reminders:</b>\n";
        reminders.forEach((r, i) => {
          replyMsg += `${i + 1}. <b>${r.content}</b>\n`;
          const snippet = r.content.length > 20 ? `${r.content.substring(0, 20)}…` : r.content;
          inlineKeyboard.push([
            {
              text: `🗑️ Reminder #${i + 1}: ${snippet}`,
              callback_data: `del_rem_${r._id}`,
            },
          ]);
        });
        replyMsg += "\n";
      }

      if (tasks.length > 0) {
        replyMsg += "<b>📋 Pending Tasks:</b>\n";
        tasks.slice(0, 5).forEach((t, i) => {
          replyMsg += `${i + 1}. ${t.content}\n`;
          const snippet = t.content.length > 20 ? `${t.content.substring(0, 20)}…` : t.content;
          inlineKeyboard.push([
            {
              text: `🗑️ Task #${i + 1}: ${snippet}`,
              callback_data: `del_task_${t._id}`,
            },
          ]);
        });
      }

      if (reminders.length > 1) {
        inlineKeyboard.push([
          {
            text: "🗑️ Delete All Reminders",
            callback_data: "del_rem_all",
          },
        ]);
      }

      return ctx.reply(replyMsg, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: inlineKeyboard },
      });
    }

    const arg = parts.slice(1).join(" ").trim();

    // If user says "/delete reminders" or "/delete all reminders"
    if (/^(all reminders?|reminders?)$/i.test(arg)) {
      const res = await Memory.deleteMany({ chatId, type: "reminder" });
      return ctx.reply(`🗑️ Cleared all ${res.deletedCount} reminders! ✨`);
    }

    // If user specified a numeric index (e.g. /delete 1)
    if (/^\d+$/.test(arg)) {
      const idx = parseInt(arg, 10) - 1;
      const reminders = await getReminders(chatId);
      if (reminders[idx]) {
        await Memory.findByIdAndDelete(reminders[idx]._id);
        return ctx.reply(`🗑️ Deleted reminder: "${reminders[idx].content}"`);
      }
      const tasks = await getPendingTasks(chatId);
      if (tasks[idx]) {
        await Memory.findByIdAndDelete(tasks[idx]._id);
        return ctx.reply(`🗑️ Deleted task: "${tasks[idx].content}"`);
      }
      return ctx.reply(`❌ Item #${arg} not found.`);
    }

    // Try deleting by ObjectId or content keyword
    try {
      const item = await deleteMemory(chatId, arg);
      if (item) {
        ctx.reply(`🗑️ Deleted ${item.type || "item"}: ${item.content}`);
      } else {
        ctx.reply("❌ Item not found or doesn't belong to you.");
      }
    } catch (error) {
      console.error("Delete command error:", error);
      ctx.reply("❌ Could not delete item.");
    }
  }));

  // Handle task deletion callback if triggered from /delete
  bot.action(/^del_task_(.+)$/, async (ctx) => {
    try {
      const taskId = ctx.match[1];
      const chatId = ctx.chat?.id || ctx.from?.id;
      const deleted = await Memory.findOneAndDelete({ _id: taskId, chatId });
      if (deleted) {
        await ctx.answerCbQuery(`🗑️ Deleted: "${deleted.content}"`);
        try {
          await ctx.editMessageText(`🗑️ Deleted task: "${deleted.content}"`);
        } catch (e) {
          await ctx.reply(`🗑️ Deleted task: "${deleted.content}"`);
        }
      } else {
        await ctx.answerCbQuery("Task not found or already deleted.");
      }
    } catch (err) {
      console.error("del_task error:", err);
      try {
        await ctx.answerCbQuery("Error deleting task");
      } catch (e) {}
    }
  });
};
