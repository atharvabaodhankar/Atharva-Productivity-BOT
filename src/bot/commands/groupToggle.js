const GroupConfig = require("../../models/GroupConfig");
const { CHAT_ID } = require("../../config/env");

module.exports = (bot) => {
  const OWNER_ID = "5275149287";

  const handleToggle = async (ctx, enable) => {
    const chatType = ctx.chat.type;
    const isGroup = chatType === "group" || chatType === "supergroup";

    if (!isGroup) {
      return ctx.reply("Private DMs are always active! /on and /off are for controlling bot activity in Telegram groups. 😊");
    }

    const callerId = String(ctx.from?.id || "");
    const configuredOwnerId = String(process.env.CHAT_ID || CHAT_ID || OWNER_ID).trim();

    if (callerId !== OWNER_ID && callerId !== configuredOwnerId) {
      return ctx.reply("🔒 Only my Creator Atharva (@op_athu) can turn me ON or OFF in this group!");
    }

    try {
      await GroupConfig.findOneAndUpdate(
        { chatId: ctx.chat.id },
        {
          enabled: enable,
          title: ctx.chat.title || "Group Chat",
          updatedBy: ctx.from.id,
        },
        { upsert: true, new: true }
      );

      if (enable) {
        ctx.reply(
          `⚡ *AtharvaOS is now ACTIVE in this group!*\n\n` +
          `💡 *How to talk to me:*\n` +
          `👉 Tag me \`@${ctx.botInfo?.username || "Atharva_Productivity_Bot"}\` in any message, or\n` +
          `👉 Reply directly to any of my messages.\n\n` +
          `_I will only respond when tagged or replied to so I never spam the group! 🚀_`,
          { parse_mode: "Markdown" }
        );
      } else {
        ctx.reply("💤 *AtharvaOS has been turned OFF in this group.* Use `/on` to activate me anytime, Atharva bhai! 🌙", { parse_mode: "Markdown" });
      }
    } catch (err) {
      console.error("Group toggle error:", err);
      ctx.reply("Error updating group settings.");
    }
  };

  bot.command("on", (ctx) => handleToggle(ctx, true));
  bot.command("enable", (ctx) => handleToggle(ctx, true));
  bot.command("off", (ctx) => handleToggle(ctx, false));
  bot.command("disable", (ctx) => handleToggle(ctx, false));
};
