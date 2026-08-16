const { PollyClient, SynthesizeSpeechCommand } = require("@aws-sdk/client-polly");
const User = require("../models/User");
const History = require("../models/History");

const polly = new PollyClient({
  region: process.env.AWS_REGION || "ap-south-1",
});

const OWNER_ID = "5275149287";
const DAILY_VOICE_LIMIT = 5;

// Clean text for speech synthesis (strip markdown, asterisks, URLs, formatting clutter)
function cleanTextForSpeech(text) {
  if (!text) return "";
  let clean = text
    .replace(/```[\s\S]*?```/g, "Code block omitted.")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[#*~`><]/g, "")
    .trim();

  // Keep speech prompt concise and snappy for voice notes (up to 1000 characters)
  if (clean.length > 1000) {
    clean = clean.slice(0, 997) + "...";
  }
  return clean;
}

// Check and increment daily voice note quota (Owner: unlimited, Others: 5/day)
async function checkVoiceQuota(chatId) {
  const isOwner = String(chatId) === OWNER_ID;
  if (isOwner) {
    return { allowed: true, remaining: 999, isOwner: true };
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  let user = await User.findOne({ telegramId: Number(chatId) });
  if (!user) {
    user = await User.create({ telegramId: Number(chatId), firstName: "Friend" });
  }

  if (!user.voiceUsage || user.voiceUsage.lastUsedDate !== todayStr) {
    user.voiceUsage = { countToday: 0, lastUsedDate: todayStr };
  }

  if (user.voiceUsage.countToday >= DAILY_VOICE_LIMIT) {
    return {
      allowed: false,
      remaining: 0,
      limit: DAILY_VOICE_LIMIT,
      isOwner: false,
    };
  }

  user.voiceUsage.countToday += 1;
  await user.save();

  return {
    allowed: true,
    remaining: DAILY_VOICE_LIMIT - user.voiceUsage.countToday,
    used: user.voiceUsage.countToday,
    limit: DAILY_VOICE_LIMIT,
    isOwner: false,
  };
}

// Synthesize audio using Amazon Polly Standard Matthew Voice (100% Free Tier)
async function synthesizeSpeech(text, voiceId = "Matthew") {
  const clean = cleanTextForSpeech(text);
  if (!clean) {
    throw new Error("No readable text found to synthesize.");
  }

  const command = new SynthesizeSpeechCommand({
    Engine: "standard",
    VoiceId: voiceId, // Standard Matthew Voice
    OutputFormat: "ogg_vorbis",
    Text: clean,
  });

  const response = await polly.send(command);
  const stream = response.AudioStream;

  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// Send AI Voice Reply via Telegram bot
async function sendAiVoiceReply(bot, chatId, text, options = {}) {
  const voiceId = options.voiceId || "Matthew";
  const audioBuffer = await synthesizeSpeech(text, voiceId);

  const sentMsg = await bot.telegram.sendVoice(
    chatId,
    { source: audioBuffer, filename: "voice_reply.ogg" },
    {
      caption: options.caption || "🎙️ <i>Spoken by AtharvaOS (Matthew AI Voice)</i>",
      parse_mode: "HTML",
      reply_to_message_id: options.replyToMessageId || undefined,
    }
  );

  await History.create({
    chatId: Number(chatId),
    role: "assistant",
    content: `[🎙️ Voice Note: ${text.slice(0, 100)}...]`,
    telegramMessageId: sentMsg?.message_id || null,
  });

  return sentMsg;
}

module.exports = {
  cleanTextForSpeech,
  checkVoiceQuota,
  synthesizeSpeech,
  sendAiVoiceReply,
  DAILY_VOICE_LIMIT,
};
