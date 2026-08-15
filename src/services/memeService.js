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
  const isVideo = /\.mp4(\?.*)?$/i.test(mediaUrl) || options.mediaType === "video" || mediaUrl.includes("v.redd.it");
  const isPhoto = /\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(mediaUrl) || options.mediaType === "image";

  const { mediaType, ...tgOptions } = options;

  try {
    if (isVideo && !isGif) {
      // Buffer download for videos guarantees Telegram renders full native video player with audio
      try {
        const vidRes = await fetch(mediaUrl);
        if (vidRes.ok) {
          const arrayBuffer = await vidRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          return await bot.telegram.sendVideo(
            targetChatId,
            { source: buffer, filename: "video.mp4" },
            { ...tgOptions, supports_streaming: true }
          );
        }
      } catch (bufErr) {
        console.warn("sendTelegramMediaSafely buffer download failed, trying direct URL sendVideo:", bufErr.message);
      }
      return await bot.telegram.sendVideo(targetChatId, mediaUrl, { ...tgOptions, supports_streaming: true });
    } else if (isGif) {
      return await bot.telegram.sendAnimation(targetChatId, mediaUrl, tgOptions);
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
    try {
      return await bot.telegram.sendMessage(
        targetChatId,
        `${captionText}\n\n🖼️ <a href="${cleanUrl}">View Media Link</a>`,
        {
          parse_mode: "HTML",
          reply_markup: tgOptions ? tgOptions.reply_markup : undefined,
        }
      );
    } catch (fallbackErr) {
      console.error("sendTelegramMediaSafely plain text fallback also failed:", fallbackErr.message);
      return null;
    }
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
    message: `User requested NSFW meme: "${meme.title}". Approve to deliver with spoiler.`,
    memeRequestId: reqDoc._id,
    memeUrl: meme.url,
    mediaType: reqDoc.mediaType,
    memeStatus: "PENDING",
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

// Universal Approval & Delivery Processor (Invoked by Telegram Callback OR Admin Console Webhook)
async function processMemeApproval(bot, requestId, isApproved) {
  const reqDoc = await MemeRequest.findById(requestId);
  if (!reqDoc) {
    throw new Error("Meme request not found or expired.");
  }

  if (reqDoc.status !== "PENDING") {
    return { ok: true, status: reqDoc.status, message: `Request already ${reqDoc.status.toLowerCase()}` };
  }

  if (isApproved) {
    reqDoc.status = "APPROVED";
    await reqDoc.save();

    // Deliver to User with Telegram native spoiler
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

    // Update related alerts
    await Alert.updateMany({ memeRequestId: reqDoc._id }, { memeStatus: "APPROVED", isRead: true });

    return { ok: true, status: "APPROVED", reqDoc };
  } else {
    reqDoc.status = "REJECTED";
    await reqDoc.save();

    // Inform User
    const rejectNotice = "Sorry bhai! 😇 Admin ne meme request approve nahi ki. Sharafat me hi bhalai hai, wapas kaam pe lago! 🚀✨";
    await bot.telegram.sendMessage(reqDoc.chatId, rejectNotice);

    await History.create({
      chatId: reqDoc.chatId,
      role: "assistant",
      content: rejectNotice,
    });

    // Update related alerts
    await Alert.updateMany({ memeRequestId: reqDoc._id }, { memeStatus: "REJECTED", isRead: true });

    return { ok: true, status: "REJECTED", reqDoc };
  }
}

async function handleMemeApprovalAction(bot, ctx, requestId, isApproved) {
  try {
    const res = await processMemeApproval(bot, requestId, isApproved);
    if (!res.ok) {
      return ctx.answerCbQuery(res.message || "Failed to process request");
    }

    if (isApproved) {
      await ctx.answerCbQuery("Approved! Delivering meme to user... 🌶️");
      const reqDoc = res.reqDoc;
      const updatedOwnerHtml =
        `✅ <b>[APPROVED & DELIVERED]</b>\n\n` +
        `👤 <b>User:</b> ${escapeHtml(reqDoc?.userName)} (@${escapeHtml(reqDoc?.username || "none")})\n` +
        `🌶️ <b>Title:</b> ${escapeHtml(reqDoc?.memeTitle)}\n` +
        `🚀 <b>Status:</b> Transmitted to user chat with spoiler blur!`;

      try {
        await ctx.editMessageCaption(updatedOwnerHtml, { parse_mode: "HTML" });
      } catch (e) {
        try {
          await ctx.editMessageText(updatedOwnerHtml, { parse_mode: "HTML" });
        } catch (e2) {}
      }
    } else {
      await ctx.answerCbQuery("Request rejected.");
      const reqDoc = res.reqDoc;
      const updatedOwnerHtml =
        `❌ <b>[REJECTED & BLOCKED]</b>\n\n` +
        `👤 <b>User:</b> ${escapeHtml(reqDoc?.userName)} (@${escapeHtml(reqDoc?.username || "none")})\n` +
        `🌶️ <b>Title:</b> ${escapeHtml(reqDoc?.memeTitle)}\n` +
        `🛑 <b>Status:</b> Denied. User was notified to stay disciplined!`;

      try {
        await ctx.editMessageCaption(updatedOwnerHtml, { parse_mode: "HTML" });
      } catch (e) {
        try {
          await ctx.editMessageText(updatedOwnerHtml, { parse_mode: "HTML" });
        } catch (e2) {}
      }
    }
  } catch (err) {
    console.error("handleMemeApprovalAction error:", err);
    ctx.answerCbQuery(err.message || "Error processing approval");
  }
}

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function sendRandomMemeToChat(bot, chatId) {
  const meme = await fetchRandomNsfwMeme();
  if (!meme || !meme.url) {
    throw new Error("Could not fetch meme from Reddit API at this moment.");
  }

  const userCaption = `🌶️ <b>${escapeHtml(meme.title || "Random NSFW Meme")}</b>\n\n<i>(Transmitted from Mission Control Console)</i>`;

  const sentMsg = await sendTelegramMediaSafely(bot, chatId, meme.url, {
    caption: userCaption,
    parse_mode: "HTML",
    has_spoiler: true,
    mediaType: meme.mediaType,
  });

  const historyDoc = await History.create({
    chatId: Number(chatId),
    role: "assistant",
    content: `[Meme: ${meme.title}]`,
    telegramMessageId: sentMsg?.message_id || null,
    hasSpoiler: true,
  });

  return { ok: true, meme, history: historyDoc };
}

async function fetchSubredditContent({ subreddit = "", category = "all", filterVideo = false } = {}) {
  const apiUrl = MEME_API_URL || process.env.MEME_API_URL || "https://redditreels.onrender.com";
  const apiKey = MEME_API_KEY || process.env.MEME_API_KEY || "rr_live_9f8d7a6b5c4e3d2a1f0e8d7c6b5a4f3e";

  let endpoint = `${apiUrl}/api/memes/random?`;
  const params = [];
  if (subreddit) params.push(`subreddit=${encodeURIComponent(subreddit)}`);
  if (category && !subreddit) params.push(`category=${encodeURIComponent(category)}`);
  endpoint += params.join("&");

  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch(endpoint, {
        headers: { "x-api-key": apiKey, Accept: "application/json" },
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data || !data.url) continue;

      if (!filterVideo) return data;
      const isVid = data.mediaType === "video" || /\.mp4(\?.*)?$/i.test(data.url) || data.url.includes("v.redd.it");
      if (isVid) return data;
    }

    if (filterVideo) {
      const vidSub = subreddit || "dankvideos";
      const vidRes = await fetch(`${apiUrl}/api/memes/random?subreddit=${encodeURIComponent(vidSub)}`, {
        headers: { "x-api-key": apiKey, Accept: "application/json" },
      });
      if (vidRes.ok) {
        const vidData = await vidRes.json();
        if (vidData && vidData.url) return vidData;
      }
    }
  } catch (err) {
    console.error("fetchSubredditContent error:", err.message);
  }
  return null;
}

async function sendSubredditVideo(bot, chatId, subreddit = "dankvideos") {
  const media = await fetchSubredditContent({ subreddit, filterVideo: true });
  if (!media || !media.url) {
    throw new Error(`Unable to fetch video from r/${subreddit} right now.`);
  }

  const captionHtml = `🎬 <b>${markdownToTelegramHtml(media.title || "Reddit Video")}</b>\n\n📂 <i>r/${escapeHtml(media.subreddit || subreddit)}</i> • <a href="${media.permalink || media.url}">Reddit Source Link</a>`;

  const sentMsg = await sendTelegramMediaSafely(bot, chatId, media.url, {
    caption: captionHtml,
    parse_mode: "HTML",
    mediaType: "video",
  });

  await History.create({
    chatId: Number(chatId),
    role: "assistant",
    content: `[Video: ${media.title}] (r/${media.subreddit || subreddit})`,
    telegramMessageId: sentMsg?.message_id || null,
  });

  return { media, sentMsg };
}

module.exports = {
  fetchRandomNsfwMeme,
  fetchSubredditContent,
  sendSubredditVideo,
  requestOwnerMemeApproval,
  handleMemeApprovalAction,
  processMemeApproval,
  sendRandomMemeToChat,
};
