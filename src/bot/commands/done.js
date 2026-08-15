const { completeMemory } = require("../../services/memoryService");
const { privateOnly } = require("../middlewares/privateOnly");

module.exports = (bot) => {
  bot.command("done", privateOnly(async (ctx) => {
    const args = ctx.message.text.split(" ");
    if (args.length < 2) {
      return ctx.reply("Arre bhai! Usage: /done <task_id>\nGet task ID from /tasks command 😊");
    }

    const taskId = args[1];
    const chatId = ctx.chat.id;

    try {
      const task = await completeMemory(chatId, taskId);

      if (task) {
        const celebrations = [
          `🎉 BOOM! Task completed: ${task.content}\n\nYou're on FIRE today! 🔥 Keep going, champion! 💪`,
          `✅ LESSGOOO! ${task.content} ✓\n\nKya baat hai! One down, let's crush the rest! 🚀`,
          `🏆 YESSS! ${task.content} - DONE!\n\nYou're unstoppable! This is what I'm talking about! 💯`,
          `⚡ SHABASH! ${task.content} complete!\n\nMomentum building! Don't stop now! 🎯`,
        ];
        ctx.reply(celebrations[Math.floor(Math.random() * celebrations.length)]);
      } else {
        ctx.reply("Hmm... Task not found yaar 🤔 Check the ID with /tasks");
      }
    } catch (error) {
      ctx.reply("Oops! Invalid task ID bro 😅 Use /tasks to get the right one");
    }
  }));
};
