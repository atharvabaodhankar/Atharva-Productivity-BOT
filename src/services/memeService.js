const { MEME_API_URL, MEME_API_KEY, BOT_TOKEN } = require("../config/env");
const MemeRequest = require("../models/MemeRequest");
const History = require("../models/History");
const Alert = require("../models/Alert");
const { markdownToTelegramHtml } = require("../utils/telegramFormatter");
const { Markup } = require("telegraf");

const OWNER_ID = "5275149287";

async function fetchRandomNsfwMeme() {
  const apiUrl = MEME_API_URL || process.env.MEME_API_URL;
  const apiKey = MEME_API_KEY || process.env.MEME_API_KEY;

  if (!apiUrl || !apiKey) {
    console.error("fetchRandomNsfwMeme: MEME_API_URL or MEME_API_KEY is not configured in environment variables.");
    return null;
  }

  try {
    const res = await fetch(`${apiUrl}/api/memes/random?category=nsfw`, {
      headers: {
        "x-api-key": apiKey,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`Meme API responded with status ${res.status}`);
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.error("fetchRandomNsfwMeme error:", err.message);
    return null;
  }
}

// Helper to send media to Telegram with format detection
async function sendTelegramMediaSafely(bot, targetChatId, mediaUrl, options = {}) {
  const isGif = /\.gif(\?.*)?$/i.test(mediaUrl) || options.mediaType === "gif";
  const isVideo = /\.mp4(\?.*)?$/i.test(mediaUrl) || options.mediaType === "video";
  const isPhoto = /\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(mediaUrl) || options.mediaType === "image";

  const { mediaType, ...tgOptions } = options;

  try {
    if (isGif) {
      return await bot.telegram.sendAnimation(targetChatId, mediaUrl, tgOptions);
    } else if (isVideo) {
      return await bot.telegram.sendVideo(targetChatId, mediaUrl, tgOptions);
    } else if (isPhoto) {
      return await bot.telegram.sendPhoto(targetChatId, mediaUrl, tgOptions);
    } else {
      // Try photo first, fallback to animation
      try {
        return await bot.telegram.sendPhoto(targetChatId, mediaUrl, tgOptions);
      } catch (photoErr) {
        return await bot.telegram.sendAnimation(targetChatId, mediaUrl, tgOptions);
      }
    }
  } catch (sendErr) {
    console.warn("sendTelegramMediaSafely media dispatch failed, falling back to message:", sendErr.message);
    const captionText = options.caption || "";
    const cleanUrl = mediaUrl;
    return await bot.telegram.sendMessage(
      targetChatId,
      `${captionText}\n\n🖼️ <a href="${cleanUrl}">View Media</a>`,
      {
        parse_mode: "HTML",
        reply_markup: tgOptions.reply_markup,
      }
    );
  }
}

async function requestOwnerMemeApproval(bot, { chatId, userName, username }) {
  const meme = await fetchRandomNsfwMeme();

  if (!meme || !meme.url) {
    throw new Error("Unable to fetch meme from Reddit API at this moment.");
  }

  // 1. Create DB Record
  const reqDoc = await MemeRequest.create({
    chatId: Number(chatId),
    userName: userName || "Friend",
    username: username || "",
    memeTitle: meme.title || "Random NSFW Meme",
    memeUrl: meme.url,
    mediaType: meme.mediaType || (meme.url.endsWith(".gif") ? "gif" : meme.url.endsWith(".mp4") ? "video" : "image"),
    subreddit: meme.subreddit || "NSFWMemes",
    permalink: meme.permalink || "",
    status: "PENDING",
  });

  // 2. Log Alert in DB for Admin Console
  await Alert.create({
    chatId: Number(chatId),
    userName: userName || "Friend",
    username: username || "",
    type: "NSFW_TRIGGER",
    trigger: "Meme Approval Pending",
    message: `User requested NSFW meme: "${meme.title}". Waiting for owner Telegram approval...`,
  });

  // 3. Send Approval Message to Atharva's Telegram
  const htmlCaption =
    `🚨🔞 <b>[ATHARVAOS // MEME APPROVAL REQUIRED]</b>\n\n` +
    `👤 <b>Requester:</b> ${escapeHtml(userName)} (@${escapeHtml(username || "none")} | <code>${chatId}</code>)\n` +
    `🌶️ <b>Title:</b> ${escapeHtml(meme.title)}\n` +
    `📂 <b>Subreddit:</b> r/${escapeHtml(meme.subreddit || "NSFWMemes")}\n` +
    `🔗 <b>Source:</b> <a href="${meme.permalink || meme.url}">Reddit Post Link</a>\n\n` +
    `<i>Do you approve sending this meme with spoiler blur to the user?</i>`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback("✅ Approve & Send", `meme_appr_${reqDoc._id}`),
      Markup.button.callback("❌ Reject", `meme_rejc_${reqDoc._id}`),
    ],
  ]);

  await sendTelegramMediaSafely(bot, OWNER_ID, meme.url, {
    caption: htmlCaption,
    parse_mode: "HTML",
    mediaType: meme.mediaType,
    ...keyboard,
  });

  return reqDoc;
}

async function handleMemeApprovalAction(bot, ctx, requestId, isApproved) {
  const reqDoc = await MemeRequest.findById(requestId);
  if (!reqDoc) {
    return ctx.answerCbQuery("Request not found or already expired.");
  }

  if (reqDoc.status !== "PENDING") {
    return ctx.answerCbQuery(`Request already ${reqDoc.status.toLowerCase()}!`);
  }

  if (isApproved) {
    reqDoc.status = "APPROVED";
    await reqDoc.save();

    await ctx.answerCbQuery("Approved! Delivering meme to user... 🌶️");

    // Deliver to User
    const userCaption = `🌶️ <b>${escapeHtml(reqDoc.memeTitle)}</b>\n\n<i>(Approved & delivered by AtharvaOS)</i>`;

    const sentMsg = await sendTelegramMediaSafely(bot, reqDoc.chatId, reqDoc.memeUrl, {
      caption: userCaption,
      parse_mode: "HTML",
      has_spoiler: true,
      mediaType: reqDoc.mediaType,
    });

    // Save in User History
    await History.create({
      chatId: reqDoc.chatId,
      role: "assistant",
      content: `[Meme: ${reqDoc.memeTitle}] (Approved by Atharva)`,
      telegramMessageId: sentMsg?.message_id || null,
      hasSpoiler: true,
    });

    // Update Owner Message
    const updatedOwnerHtml =
      `✅ <b>[APPROVED & DELIVERED]</b>\n\n` +
      `👤 <b>User:</b> ${escapeHtml(reqDoc.userName)} (@${escapeHtml(reqDoc.username || "none")})\n` +
      `🌶️ <b>Title:</b> ${escapeHtml(reqDoc.memeTitle)}\n` +
      `🚀 <b>Status:</b> Transmitted to user chat with spoiler blur!`;

    try {
      await ctx.editMessageCaption(updatedOwnerHtml, { parse_mode: "HTML" });
    } catch (e) {
      try {
        await ctx.editMessageText(updatedOwnerHtml, { parse_mode: "HTML" });
      } catch (e2) {}
    }
  } else {
    reqDoc.status = "REJECTED";
    await reqDoc.save();

    await ctx.answerCbQuery("Request rejected.");

    // Inform User
    const rejectNotice = "Sorry bhai! 😇 Admin ne meme request approve nahi ki. Sharafat me hi bhalai hai, wapas kaam pe lago! 🚀✨";
    await bot.telegram.sendMessage(reqDoc.chatId, rejectNotice);

    await History.create({
      chatId: reqDoc.chatId,
      role: "assistant",
      content: rejectNotice,
    });

    // Update Owner Message
    const updatedOwnerHtml =
      `❌ <b>[REJECTED & BLOCKED]</b>\n\n` +
      `👤 <b>User:</b> ${escapeHtml(reqDoc.userName)} (@${escapeHtml(reqDoc.username || "none")})\n` +
      `🌶️ <b>Title:</b> ${escapeHtml(reqDoc.memeTitle)}\n` +
      `🛑 <b>Status:</b> Denied. User was notified to stay disciplined!`;

    try {
      await ctx.editMessageCaption(updatedOwnerHtml, { parse_mode: "HTML" });
    } catch (e) {
      try {
        await ctx.editMessageText(updatedOwnerHtml, { parse_mode: "HTML" });
      } catch (e2) {}
    }
  }
}

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

module.exports = {
  fetchRandomNsfwMeme,
  requestOwnerMemeApproval,
  handleMemeApprovalAction,
};
