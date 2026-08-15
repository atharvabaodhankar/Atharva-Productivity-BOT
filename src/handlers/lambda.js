const bot = require("../bot");
const { connectToDatabase } = require("../config/db");
const {
  checkUpcomingReminders,
  sendDailySummary,
  sendNightlyReflection,
} = require("../services/reminderService");

exports.handler = async (event, context) => {
  if (context) {
    context.callbackWaitsForEmptyEventLoop = false;
  }

  try {
    await connectToDatabase();

    // 1. Scheduled EventBridge Triggers
    if (
      event.source === "aws.events" ||
      event["detail-type"] === "Scheduled Event" ||
      event.cron
    ) {
      console.log("Triggered by EventBridge:", event.task || "default");
      if (event.task === "dailySummary") {
        await sendDailySummary(bot);
      } else if (event.task === "nightlyReflection") {
        await sendNightlyReflection(bot);
      } else {
        await checkUpcomingReminders(bot);
      }

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Scheduled task executed" }),
      };
    }

    // 2. Telegram Webhook HTTP POST
    if (event.body) {
      const body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
      await bot.handleUpdate(body);

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Update processed successfully" }),
      };
    }

    // Health check ping
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "AtharvaOS Lambda is online 🚀" }),
    };
  } catch (error) {
    console.error("Lambda error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
