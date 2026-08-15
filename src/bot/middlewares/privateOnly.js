const { Markup } = require("telegraf");

function privateOnly(handler) {
  return async (ctx, next) => {
    const isGroup = ctx.chat.type === "group" || ctx.chat.type === "supergroup";
    if (isGroup) {
      return ctx.reply(
        "🔒 *Your tasks and reminders are strictly private!*\n\n" +
        "To view or manage your personal schedule, tasks, and reminders, please chat with me in private DM! 😊",
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "💬 Open Private DM",
                  url: "https://t.me/Atharva_Produtivity_Bot",
                },
              ],
            ],
          },
          reply_to_message_id: ctx.message?.message_id,
        }
      );
    }
    return handler(ctx, next);
  };
}

module.exports = { privateOnly };
