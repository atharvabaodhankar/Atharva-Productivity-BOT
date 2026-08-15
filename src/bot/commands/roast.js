const Memory = require("../../models/Memory");

module.exports = (bot) => {
  bot.command("roast", async (ctx) => {
    const chatId = ctx.chat.id;
    const name = ctx.state.user ? ctx.state.user.firstName : "bhai";

    const pendingCount = await Memory.countDocuments({
      chatId,
      type: { $in: ["task", "assignment", "project"] },
      completed: false,
    });

    const roasts = [
      `Arre ${name}, ${pendingCount} tasks pending hain aur tu roast maang raha hai? 😂 Priorities set kar pehle! 📚`,
      `Bhai ${name}, Netflix pe PhD kar raha hai kya? 😅 Chal laptop khol aur kuch productive kar! 💻`,
      `Procrastination level: EXPERT 😂 But seriously ${name}, let's get to work! Time's ticking! ⏰`,
      `${pendingCount} tasks pending... ${name} tu toh legend hai! Ab kaam karke bhi dikha de! 💪😂`,
      `Instagram reels scroll karke success nahi milegi ${name} bro 😂 Focus mode ON kar! 🎯`,
    ];

    if (pendingCount === 0) {
      ctx.reply(`Roast? ${name} tu toh already crushing it! 🔥 All tasks done! Proud of you! 🎉`);
    } else {
      ctx.reply(roasts[Math.floor(Math.random() * roasts.length)]);
    }
  });
};
