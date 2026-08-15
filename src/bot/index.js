const { Telegraf } = require("telegraf");
const { BOT_TOKEN } = require("../config/env");
const { userMiddleware } = require("./middlewares/userMiddleware");

if (!BOT_TOKEN) {
  console.warn("⚠️ Warning: BOT_TOKEN is missing in environment variables!");
}

const bot = new Telegraf(BOT_TOKEN);

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
require("./commands/help")(bot);

// 3. Attach message & photo handlers
require("./handlers/textHandler")(bot);
require("./handlers/photoHandler")(bot);

module.exports = bot;
