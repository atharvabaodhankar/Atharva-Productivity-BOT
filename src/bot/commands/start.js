const { Markup } = require("telegraf");
const { CHAT_ID } = require("../../config/env");

module.exports = (bot) => {
  bot.start((ctx) => {
    const user = ctx.state.user;
    const senderId = String(ctx.chat?.id || ctx.from?.id || "");
    const username = (user?.username || ctx.from?.username || "").toLowerCase().replace(/^@/, "");
    const name = user ? user.firstName : (ctx.from?.first_name || "Champ");
    const webappUrl = process.env.WEBAPP_URL;
    const adminId = String(process.env.CHAT_ID || CHAT_ID || "5275149287").trim();

    // 1. VIP CREATOR MODE FOR ATHARVA (@op_athu / 5275149287) ONLY
    if (senderId === "5275149287" || senderId === adminId || username === "op_athu") {
      const creatorGreeting = `👑 *WELCOME BACK, ATHARVA! (CREATOR MODE ACTIVE ⚡)*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Master builder, all systems are operational on *Amazon Bedrock* & *AWS ap-south-1*.\n\n` +
        `What would you like to inspect or accomplish today?`;

      const creatorKeyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback("📊 Live System & Token Stats", "cb_creator_stats"),
          Markup.button.callback("📋 My Tasks & Game Plan", "cb_creator_tasks"),
        ],
        [
          Markup.button.callback("⏰ Active Reminders", "cb_creator_reminders"),
          Markup.button.callback("🎙️ Test Polly Voice Note", "cb_creator_voice"),
        ],
        [
          Markup.button.callback("🧠 Bedrock Health Check", "cb_creator_bedrock"),
        ],
      ]);

      return ctx.reply(creatorGreeting, {
        parse_mode: "Markdown",
        reply_markup: creatorKeyboard.reply_markup,
      });
    }

    // 2. Custom Persona for @eshhh_02 ONLY
    if (username === "eshhh_02") {
      const specialGreeting = `Hi Ashu ❤️ This is a bot by your husband Athi, he modified me just for you to talk like this! ✨\n\nReady to organize your day and crush some goals? I'm right here for you, Ashu! 🌸`;

      if (webappUrl) {
        return ctx.reply(
          specialGreeting,
          Markup.inlineKeyboard([
            [Markup.button.webApp("🚀 Open Web Dashboard", webappUrl)],
          ])
        );
      }
      return ctx.reply(specialGreeting);
    }

    // 3. Default Greetings for all other users
    const funGreetings = [
      `Yo yo yo ${name}! AtharvaOS is LIVE! 🚀\nReady to crush some goals today? Let's goooo! 💪`,
      `Arre ${name} bhai! Your personal productivity copilot is here! 🔥\nBata kya karna hai aaj? Let's make it happen! 💯`,
      `LESSGOOO ${name}! 🎯 AtharvaOS activated!\nTime to turn those dreams into reality! ⚡`,
      `Ayeee ${name}! What's good? 😎\nYour second brain is online and ready to help you dominate! 🏆`,
    ];

    const greeting = funGreetings[Math.floor(Math.random() * funGreetings.length)];

    if (webappUrl) {
      return ctx.reply(
        greeting,
        Markup.inlineKeyboard([
          [Markup.button.webApp("🚀 Open Web Dashboard", webappUrl)],
        ])
      );
    }

    ctx.reply(greeting);
  });
};
