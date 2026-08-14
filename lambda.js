require("dotenv").config();
const bot = require("./bot");
const { connectToDatabase } = require("./db");
const { checkUpcomingReminders, sendDailySummary, sendNightlyReflection } = require("./reminderService");

/**
 * AWS Lambda Handler
 * Handles:
 * 1. Telegram Webhook HTTP POST events (via Lambda Function URL or API Gateway)
 * 2. AWS EventBridge Scheduled Events (for future scope cron triggers)
 */
exports.handler = async (event, context) => {
  // Prevent Lambda from hanging if database connections remain in event loop
  if (context) {
    context.callbackWaitsForEmptyEventLoop = false;
  }

  try {
    await connectToDatabase();

    // -------------------------------------------------------------
    // 1. AWS EventBridge Trigger (Future Scope for Scheduled Tasks)
    // -------------------------------------------------------------
    if (event.source === "aws.events" || event["detail-type"] === "Scheduled Event" || event.cron) {
      console.log("Triggered by AWS EventBridge Schedule:", event.task || "default");

      if (event.task === "dailySummary") {
        await sendDailySummary(bot);
      } else if (event.task === "nightlyReflection") {
        await sendNightlyReflection(bot);
      } else {
        // Default check due reminders
        await checkUpcomingReminders(bot);
      }

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Scheduled task completed successfully" }),
      };
    }

    // -------------------------------------------------------------
    // 2. Telegram Webhook (Function URL / API Gateway)
    // -------------------------------------------------------------
    if (event.body) {
      const body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
      
      // Let Telegraf process the update received from Telegram
      await bot.handleUpdate(body);

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Update processed" }),
      };
    }

    // Health check ping (e.g. if opened in browser)
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "AtharvaOS Lambda is online 🚀" }),
    };

  } catch (error) {
    console.error("Lambda Execution Error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
