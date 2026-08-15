module.exports = (bot) => {
  bot.command("motivate", (ctx) => {
    const name = ctx.state.user ? ctx.state.user.firstName : "champ";
    const motivations = [
      `🔥 YOU ARE A MACHINE, ${name.toUpperCase()}! Nothing can stop you today! Let's GOOO! 💪`,
      `⚡ ${name}, you're literally ONE task away from being unstoppable! DO IT! 🚀`,
      `💯 Remember why you started, ${name}! You got big dreams to chase! 🎯`,
      `🏆 Champions aren't born, they're made! And you're making yourself one RIGHT NOW, ${name}! 💪`,
      `🌟 Arre ${name}, you've come so far! Don't stop now! Keep pushing! 🔥`,
      `⚡ Your future self is watching, ${name}! Make them PROUD! Let's crush it! 💪`,
      `🚀 Small steps, BIG dreams! You're doing amazing! Keep going, ${name}! 🌟`,
    ];
    ctx.reply(motivations[Math.floor(Math.random() * motivations.length)]);
  });
};
