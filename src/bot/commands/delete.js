const { deleteMemory } = require("../../services/memoryService");
const { privateOnly } = require("../middlewares/privateOnly");

module.exports = (bot) => {
  bot.command("delete", privateOnly(async (ctx) => {
    const args = ctx.message.text.split(" ");
    if (args.length < 2) {
      return ctx.reply("Usage: /delete <task_id>\nGet task ID from /tasks command");
    }

    const taskId = args[1];
    const chatId = ctx.chat.id;

    try {
      const task = await deleteMemory(chatId, taskId);

      if (task) {
        ctx.reply(`🗑️ Deleted: ${task.content}`);
      } else {
        ctx.reply("❌ Task not found or doesn't belong to you");
      }
    } catch (error) {
      ctx.reply("❌ Invalid task ID format");
    }
  }));
};
