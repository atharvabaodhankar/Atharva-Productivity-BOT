require("dotenv").config();
const { Telegraf } = require("telegraf");

const webhookUrl = process.argv[2] || process.env.WEBHOOK_URL;

if (!webhookUrl) {
  console.error("\n❌ Error: Please provide your AWS Lambda Function URL!");
  console.log("Usage: node setWebhook.js <YOUR_LAMBDA_FUNCTION_URL>\n");
  process.exit(1);
}

if (!process.env.BOT_TOKEN) {
  console.error("\n❌ Error: BOT_TOKEN is missing from .env!\n");
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);

async function setWebhook() {
  try {
    console.log(`Setting Telegram webhook to: ${webhookUrl} ...`);
    const result = await bot.telegram.setWebhook(webhookUrl);
    if (result) {
      console.log("✅ Webhook successfully linked with Telegram!");
      
      // Configure Telegram Chat Menu Button to open safe User Productivity Copilot WebApp
      const webAppUrl = process.env.WEBAPP_URL || "https://atharva-productivity-bot-owkf.vercel.app/webapp/";
      await bot.telegram.setChatMenuButton({
        menu_button: {
          type: "web_app",
          text: "🔲 Open AtharvaOS",
          web_app: { url: webAppUrl },
        },
      });
      console.log(`✅ Telegram Chat Menu Button set to: [🔲 Open AtharvaOS] -> ${webAppUrl}`);

      const info = await bot.telegram.getWebhookInfo();
      console.log("Current Webhook Status:", info);
    }
  } catch (err) {
    console.error("❌ Failed to set webhook:", err.message);
  }
}

setWebhook();
