require("dotenv").config();
const readline = require("readline");
const https = require("https");

const TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

function sendMessage(text) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ chat_id: CHAT_ID, text });
    const options = {
      hostname: "api.telegram.org",
      path: `/bot${TOKEN}/sendMessage`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      res.on("data", () => {});
      res.on("end", resolve);
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask() {
  rl.question("You: ", async (input) => {
    const message = input.trim();
    if (!message) return ask();
    if (message.toLowerCase() === "exit") { rl.close(); return; }

    await sendMessage(message);
    ask();
  });
}

console.log("Sending to Telegram 🚀  (type 'exit' to quit)\n");
ask();
