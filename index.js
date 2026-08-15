require("dotenv").config();
const bot = require("./src/bot");
const { connectToDatabase } = require("./src/config/db");
const { startReminderCron } = require("./src/services/reminderService");
const { PORT, WEBHOOK_DOMAIN } = require("./src/config/env");

async function startApp() {
  try {
    await connectToDatabase();

    if (WEBHOOK_DOMAIN) {
      bot.launch({
        webhook: {
          domain: WEBHOOK_DOMAIN,
          port: PORT,
          host: "0.0.0.0",
        },
      });
      console.log(`Telegram Bot Launched in Webhook Mode (${WEBHOOK_DOMAIN})`);
    } else {
      bot.launch();
      console.log("Telegram Bot Launched in Polling Mode (Local Dev)");
    }

    startReminderCron(bot);
  } catch (err) {
    console.error("Failed to start application:", err);
    process.exit(1);
  }
}

startApp();

process.once("SIGINT", () => {
  bot.stop("SIGINT");
  process.exit(0);
});
process.once("SIGTERM", () => {
  bot.stop("SIGTERM");
  process.exit(0);
});
