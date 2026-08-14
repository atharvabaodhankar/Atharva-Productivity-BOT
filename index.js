require("dotenv").config();
const bot = require("./bot");
const { connectToDatabase } = require("./db");
const { startReminderService } = require("./reminderService");

const PORT = process.env.PORT || 3000;

async function startApp() {
  try {
    await connectToDatabase();

    // Start bot locally
    if (process.env.WEBHOOK_DOMAIN) {
      bot.launch({
        webhook: {
          domain: process.env.WEBHOOK_DOMAIN,
          port: PORT,
          host: "0.0.0.0",
        },
      });
      console.log("Telegram Bot Launched in Webhook Mode");
    } else {
      bot.launch();
      console.log("Telegram Bot Launched in Polling Mode (Local Dev)");
    }

    // Start reminder service locally
    startReminderService(bot);

  } catch (err) {
    console.error("FAILED to start application:");
    console.error(err);
    process.exit(1);
  }
}

startApp();

// Stop services gracefully
process.once("SIGINT", () => {
  bot.stop("SIGINT");
  process.exit(0);
});
process.once("SIGTERM", () => {
  bot.stop("SIGTERM");
  process.exit(0);
});
