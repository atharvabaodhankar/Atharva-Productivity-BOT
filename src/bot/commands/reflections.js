const { getReflections } = require("../../services/memoryService");
const { privateOnly } = require("../middlewares/privateOnly");

module.exports = (bot) => {
  bot.command("reflections", privateOnly(async (ctx) => {
    const chatId = ctx.chat.id;
    const userTimezone = ctx.state.user ? ctx.state.user.timezone : "Asia/Kolkata";
    const reflections = await getReflections(chatId);

    if (reflections.length === 0) {
      return ctx.reply("📝 No reflections saved yet! Send your daily reflections anytime!");
    }

    let message = "📝 Your Recent Reflections:\n\n";
    reflections.forEach((r, i) => {
      message += `${i + 1}. "${r.content}"\n`;
      message += `   📅 ${new Date(r.createdAt).toLocaleDateString("en-US", { timeZone: userTimezone })}\n\n`;
    });

    ctx.reply(message);
  }));
};
