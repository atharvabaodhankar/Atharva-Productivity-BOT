const { Telegraf } = require("telegraf");
const { BOT_TOKEN } = require("../config/env");
const { userMiddleware } = require("./middlewares/userMiddleware");

if (!BOT_TOKEN) {
  console.warn("⚠️ Warning: BOT_TOKEN is missing in environment variables!");
}

const bot = new Telegraf(BOT_TOKEN);

// Explicitly set bot identity for serverless Lambda execution
bot.botInfo = {
  id: 7987805958,
  is_bot: true,
  first_name: "Atharva OS",
  username: "Atharva_Produtivity_Bot",
};

// 1. Attach user auto-registration middleware
bot.use(userMiddleware);

// 2. Attach modular commands
require("./commands/start")(bot);
require("./commands/tasks")(bot);
require("./commands/today")(bot);
require("./commands/done")(bot);
require("./commands/delete")(bot);
require("./commands/goals")(bot);
require("./commands/reminders")(bot);
require("./commands/reflections")(bot);
require("./commands/motivate")(bot);
require("./commands/roast")(bot);
require("./commands/admin")(bot);
require("./commands/owner")(bot);
require("./commands/groupToggle")(bot);
require("./commands/help")(bot);

// 3. Attach message, photo & video handlers
require("./handlers/textHandler")(bot);
require("./handlers/photoHandler")(bot);
require("./handlers/videoHandler")(bot);

module.exports = bot;
