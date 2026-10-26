const { completeMemory, getPendingTasks } = require("../../services/memoryService");
const { privateOnly } = require("../middlewares/privateOnly");

module.exports = (bot) => {
  // 1. Slash command /done [1 | task_title | id]
  bot.command("done", privateOnly(async (ctx) => {
    const rawText = (ctx.message.text || "").trim();
    const parts = rawText.split(/\s+/);
    const chatId = ctx.chat.id;

    if (parts.length < 2) {
      // Show interactive list if no arguments provided
      const tasks = await getPendingTasks(chatId);
      if (tasks.length === 0) {
        return ctx.reply("Woohoo! 🎉 No pending tasks! All clear champ! 😎");
      }

      let replyMsg = "✅ <b>Select a task to mark completed:</b>\n\n";
      const inlineKeyboard = [];

      tasks.slice(0, 6).forEach((t, i) => {
        replyMsg += `${i + 1}. ${t.content}\n`;
        const snippet = t.content.length > 20 ? `${t.content.substring(0, 20)}…` : t.content;
        inlineKeyboard.push([
          {
            text: `✅ Complete #${i + 1}: ${snippet}`,
            callback_data: `done_task_${t._id}`,
          },
        ]);
      });

      replyMsg += "\n💡 <i>Or simply type /done 1, /done 2, or /done <task_name></i>";

      return ctx.reply(replyMsg, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: inlineKeyboard },
      });
    }

    const query = parts.slice(1).join(" ");

    try {
      const task = await completeMemory(chatId, query);

      if (task) {
        const celebrations = [
          `🎉 *BOOM! Task completed: ${task.content}*\n\nYou're on FIRE today! 🔥 Keep going, champion! 💪`,
          `✅ *LESSGOOO! "${task.content}" DONE!* ✓\n\nKya baat hai! One down, let's crush the rest! 🚀`,
          `🏆 *YESSS! ${task.content} complete!*\n\nYou're unstoppable! This is what I'm talking about! 💯`,
          `⚡ *SHABASH! "${task.content}" marked completed!*\n\nMomentum building! Don't stop now! 🎯`,
        ];
        ctx.reply(celebrations[Math.floor(Math.random() * celebrations.length)], {
          parse_mode: "Markdown",
        });
      } else {
        ctx.reply(`Hmm... No pending task matching "${query}" found 🤔 Check your tasks with /tasks!`);
      }
    } catch (error) {
      console.error("Done command error:", error);
      ctx.reply("Oops! Couldn't complete that task 😅 Check /tasks to see what's pending.");
    }
  }));

  // 2. Inline Button Callback Query Handler for done_task_<id>
  bot.action(/^done_task_(.+)$/, async (ctx) => {
    try {
      const taskId = ctx.match[1];
      const chatId = ctx.chat.id;

      const task = await completeMemory(chatId, taskId);

      if (task) {
        await ctx.answerCbQuery(`✅ Completed: "${task.content}"! 🔥`);
        await ctx.editMessageText(
          `🎉 <b>Task Completed!</b>\n\n✅ <b>"${task.content}"</b> is done!\n\nKeep that momentum rolling! 🚀🔥`,
          { parse_mode: "HTML" }
        );
      } else {
        await ctx.answerCbQuery("Item already completed or not found!");
      }
    } catch (err) {
      console.warn("Error in done_task action:", err.message);
      try {
        await ctx.answerCbQuery("Could not complete task.");
      } catch (e) {}
    }
  });
};
