const Alert = require("../models/Alert");
const { BOT_TOKEN } = require("../config/env");

const OWNER_ID = "5275149287";

const EASTER_EGG_PATTERNS = [
  { regex: /\b(carcasting|casting couch)\b/i, type: "NSFW_TRIGGER", name: "Carcasting / Casting" },
  { regex: /\b(nsfw|porn|nude|nudes|xxx|hentai|onlyfans|boobs|bobs|vagina|vegene|strip|sex)\b/i, type: "NSFW_TRIGGER", name: "NSFW Keyword" },
  { regex: /\b(secret|secret code|secret bot|easter egg|easteregg|easter eggs)\b/i, type: "EASTER_EGG", name: "Secret / Easter Egg" },
  { regex: /\b(memes|dank meme|dank memes)\b/i, type: "EASTER_EGG", name: "Meme Search" },
  { regex: /\b(hack|hack bot|bypass|jailbreak)\b/i, type: "SECRET_COMMAND", name: "Jailbreak / Hack" },
];

const RESPONSES = [
  "Arre bhai bhai bhai! 😂 Yeh kya search ho raha hai? Lagta hai tumne ek secret easter egg dhoondh liya! 👀 Aur bhi bohot saare secret easter eggs chupe hain AtharvaOS me... try karte raho! 🥚✨\n\n💡 *P.S.* Agar NSFW memes chahiye toh `/show_meme` try karo... dekhte hain himmat hai kya! 😏",
  "Wah bete mauj kardi! 🚗💨 Carcasting ya secret codes dhoondh rahe ho? 😂 AtharvaOS ke pass aise bohot saare hidden easter eggs hain... aur dhoondho dekhte hain kya milta hai! 🕵️‍♂️🔥\n\n💡 *P.S.* NSFW memes dekhne hain? Try command `/show_meme` if you dare! 🔞",
  "Caught in 4K! 📸👀 Lagta hai curiosity peak par hai! Ek secret easter egg unlock ho gaya hai, par aur bhi bohot kuch chupa hai bot me... keep exploring! 🥚💡\n\n💡 *P.S.* Waise agar NSFW memes chahiye toh `/show_meme` try kar sakte ho! 👀",
  "Ayyy shabaash! 🤫 Secret discovery unlocked! Lekin ye toh sirf shuruat hai, try other crazy prompts and discover more secret easter eggs! 🚀✨\n\n💡 *P.S.* For NSFW memes, type `/show_meme`... 😏",
];

function getRandomResponse() {
  return RESPONSES[Math.floor(Math.random() * RESPONSES.length)];
}

function checkEasterEggOrNsfw(text) {
  if (!text) return null;
  const clean = text.trim();

  for (const item of EASTER_EGG_PATTERNS) {
    if (item.regex.test(clean)) {
      return {
        matched: true,
        type: item.type,
        trigger: item.name,
        text: clean,
      };
    }
  }
  return null;
}

async function triggerAlertAndNotify({ chatId, userName, username, type, trigger, text }) {
  try {
    // 1. Save in MongoDB
    const alertDoc = await Alert.create({
      chatId,
      userName: userName || "Anonymous",
      username: username || "",
      type: type || "EASTER_EGG",
      trigger: trigger || "Unknown Trigger",
      message: text || "",
      isRead: false,
    });

    // 2. Notify Atharva on Telegram
    if (BOT_TOKEN && String(chatId) !== OWNER_ID) {
      const alertMsg =
        `🚨 *[ATHARVAOS TRIGGER ALERT]*\n` +
        `👤 *User:* ${userName} (@${username || "none"} | \`${chatId}\`)\n` +
        `🎯 *Type:* ${type}\n` +
        `🔎 *Detected:* ${trigger}\n` +
        `💬 *Message:* "${text}"\n` +
        `⏰ *Time:* ${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}`;

      fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: OWNER_ID,
          text: alertMsg,
          parse_mode: "Markdown",
        }),
      }).catch((err) => console.warn("Failed to dispatch Telegram owner alert:", err.message));
    }

    return alertDoc;
  } catch (err) {
    console.error("Error creating alert:", err);
    return null;
  }
}

module.exports = {
  checkEasterEggOrNsfw,
  triggerAlertAndNotify,
  getRandomResponse,
};
