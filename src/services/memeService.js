const { MEME_API_URL, MEME_API_KEY, BOT_TOKEN } = require("../config/env");
const MemeRequest = require("../models/MemeRequest");
const History = require("../models/History");
const Alert = require("../models/Alert");
const { Markup } = require("telegraf");

const OWNER_ID = "5275149287";

async function fetchRandomNsfwMeme() {
  try {
    const res = await fetch(`${MEME_API_URL}/api/memes/random?category=nsfw`, {
      headers: {
        "x-api-key": MEME_API_KEY,
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
    mediaType: meme.mediaType || (meme.url.endsWith(".mp4") ? "video" : "image"),
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
  const caption =
    `🚨🔞 *[ATHARVAOS // MEME APPROVAL REQUIRED]*\n\n` +
    `👤 *Requester:* ${userName} (@${username || "none"} | \`${chatId}\`)\n` +
    `🌶️ *Title:* ${meme.title}\n` +
    `📂 *Subreddit:* r/${meme.subreddit}\n` +
    `🔗 *Source:* [Reddit Post](${meme.permalink || meme.url})\n\n` +
    `_Do you approve sending this meme with spoiler blur to the user?_`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback("✅ Approve & Send to User", `meme_appr_${reqDoc._id}`),
      Markup.button.callback("❌ Reject Request", `meme_rejc_${reqDoc._id}`),
    ],
  ]);

  try {
    const isVideo = meme.mediaType === "video" || meme.url.endsWith(".mp4");
    if (isVideo) {
      await bot.telegram.sendVideo(OWNER_ID, meme.url, {
        caption,
        parse_mode: "Markdown",
        ...keyboard,
      });
    } else {
      await bot.telegram.sendPhoto(OWNER_ID, meme.url, {
        caption,
        parse_mode: "Markdown",
        ...keyboard,
      });
    }
  } catch (tgErr) {
    // If sending media directly to owner fails (e.g. format restriction), send as text prompt
    await bot.telegram.sendMessage(
      OWNER_ID,
      `${caption}\n\n🖼️ *Direct Link:* ${meme.url}`,
      {
        parse_mode: "Markdown",
        disable_web_page_preview: false,
        ...keyboard,
      }
    );
  }

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

    await ctx.answerCbQuery("Approved! Sending meme to user with spoiler blur... 🌶️");

    // Deliver to User
    const userCaption = `🌶️ *${reqDoc.memeTitle}*\n\n_(Approved & delivered by AtharvaOS)_`;
    const isVideo = reqDoc.mediaType === "video" || reqDoc.memeUrl.endsWith(".mp4");

    let sentMsg = null;
    try {
      if (isVideo) {
        sentMsg = await bot.telegram.sendVideo(reqDoc.chatId, reqDoc.memeUrl, {
          caption: userCaption,
          parse_mode: "Markdown",
          has_spoiler: true,
        });
      } else {
        sentMsg = await bot.telegram.sendPhoto(reqDoc.chatId, reqDoc.memeUrl, {
          caption: userCaption,
          parse_mode: "Markdown",
          has_spoiler: true,
        });
      }
    } catch (deliverErr) {
      // Fallback
      sentMsg = await bot.telegram.sendMessage(
        reqDoc.chatId,
        `🌶️ *${reqDoc.memeTitle}*\n\n[Open Meme](${reqDoc.memeUrl})`,
        { parse_mode: "Markdown" }
      );
    }

    // Save in User History
    await History.create({
      chatId: reqDoc.chatId,
      role: "assistant",
      content: `[Meme: ${reqDoc.memeTitle}] (Approved by Atharva)`,
      telegramMessageId: sentMsg?.message_id || null,
      hasSpoiler: true,
    });

    // Update Owner Message
    const updatedOwnerText =
      `✅ *[APPROVED & DELIVERED]*\n\n` +
      `👤 *User:* ${reqDoc.userName} (@${reqDoc.username || "none"})\n` +
      `🌶️ *Title:* ${reqDoc.memeTitle}\n` +
      `🚀 *Status:* Successfully transmitted to user chat with spoiler blur!`;

    try {
      await ctx.editMessageCaption(updatedOwnerText, { parse_mode: "Markdown" });
    } catch (e) {
      await ctx.editMessageText(updatedOwnerText, { parse_mode: "Markdown" });
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
    const updatedOwnerText =
      `❌ *[REJECTED & BLOCKED]*\n\n` +
      `👤 *User:* ${reqDoc.userName} (@${reqDoc.username || "none"})\n` +
      `🌶️ *Title:* ${reqDoc.memeTitle}\n` +
      `🛑 *Status:* Denied. User was notified to stay disciplined!`;

    try {
      await ctx.editMessageCaption(updatedOwnerText, { parse_mode: "Markdown" });
    } catch (e) {
      await ctx.editMessageText(updatedOwnerText, { parse_mode: "Markdown" });
    }
  }
}

module.exports = {
  fetchRandomNsfwMeme,
  requestOwnerMemeApproval,
  handleMemeApprovalAction,
};
