const bot = require("../bot");
const { connectToDatabase } = require("../config/db");
const { CHAT_ID } = require("../config/env");
const User = require("../models/User");
const Memory = require("../models/Memory");
const History = require("../models/History");
const Alert = require("../models/Alert");
const { markdownToTelegramHtml } = require("../utils/telegramFormatter");
const {
  checkUpcomingReminders,
  sendDailySummary,
  sendNightlyReflection,
} = require("../services/reminderService");

// Standard CORS headers for Telegram Mini App
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, x-admin-secret, X-Admin-Secret",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Content-Type": "application/json",
};

exports.handler = async (event, context) => {
  if (context) {
    context.callbackWaitsForEmptyEventLoop = false;
  }

  // Handle CORS Preflight
  const httpMethod =
    event.httpMethod ||
    (event.requestContext && event.requestContext.http && event.requestContext.http.method) ||
    "GET";

  if (httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: "OK" }),
    };
  }

  try {
    await connectToDatabase();

    const rawPath = (event.path || event.rawPath || "/").replace(/\/$/, "");
    const queryParams = event.queryStringParameters || {};

    // -------------------------------------------------------------
    // 1. REST API ENDPOINTS FOR TELEGRAM MINI APP
    // -------------------------------------------------------------
    if (rawPath.startsWith("/api")) {
      const headers = event.headers || {};
      const reqSecret = headers["x-admin-secret"] || headers["X-Admin-Secret"] || queryParams.admin_secret || "";
      const { ADMIN_SECRET } = require("../config/env");
      const expectedSecret = process.env.ADMIN_SECRET || ADMIN_SECRET || "Atharva_SuperSecret_AdminKey_2026";

      if (rawPath.includes("/admin") || rawPath === "/api/stats" || rawPath === "/api/conversations") {
        if (reqSecret !== expectedSecret) {
          return {
            statusCode: 401,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: "Unauthorized. Invalid or missing x-admin-secret header." }),
          };
        }
      }

      // GET /api/tasks?chatId=12345
      if (rawPath === "/api/tasks" && httpMethod === "GET") {
        const chatId = queryParams.chatId;
        if (!chatId) {
          return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: "chatId query parameter is required" }),
          };
        }

        const user = await User.findOne({ telegramId: chatId });
        const tasks = await Memory.find({ chatId }).sort({ completed: 1, date: 1, createdAt: -1 });
        const total = tasks.length;
        const completed = tasks.filter((t) => t.completed).length;
        const pending = total - completed;

        // Fetch Telegram Avatar if available
        let photoUrl = null;
        try {
          const photos = await bot.telegram.getUserProfilePhotos(Number(chatId), 0, 1);
          if (photos && photos.total_count > 0 && photos.photos[0] && photos.photos[0].length > 0) {
            const fileId = photos.photos[0][photos.photos[0].length - 1].file_id;
            const fileLink = await bot.telegram.getFileLink(fileId);
            photoUrl = fileLink.href || String(fileLink);
          }
        } catch (e) {
          // Fallback
        }

        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            user: {
              firstName: user ? user.firstName : "Friend",
              telegramId: chatId,
              username: user ? user.username : "",
              photoUrl: photoUrl,
            },
            stats: {
              total,
              completed,
              pending,
              progress: total > 0 ? Math.round((completed / total) * 100) : 0,
            },
            tasks,
          }),
        };
      }

      // POST /api/tasks
      if (rawPath === "/api/tasks" && httpMethod === "POST") {
        const payload =
          typeof event.body === "string" ? JSON.parse(event.body || "{}") : event.body || {};

        if (!payload.chatId || !payload.content) {
          return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: "chatId and content are required" }),
          };
        }

        let parentProjectId = payload.projectId || null;
        let parentProjectName = payload.projectName || "";

        if (payload.projectName && payload.type !== "project" && !parentProjectId) {
          const trimmed = payload.projectName.trim();
          let p = await Memory.findOne({
            chatId: payload.chatId,
            type: "project",
            content: new RegExp(`^${trimmed}$`, "i"),
          });
          if (!p) {
            p = await Memory.create({
              chatId: payload.chatId,
              type: "project",
              content: trimmed,
              priority: "medium",
            });
          }
          parentProjectId = p._id;
          parentProjectName = p.content;
        }

        const newTask = await Memory.create({
          chatId: payload.chatId,
          type: payload.type || "task",
          content: payload.content,
          url: payload.url || "",
          date: payload.date ? new Date(payload.date) : null,
          priority: payload.priority || "medium",
          tags: Array.isArray(payload.tags) ? payload.tags : [],
          projectId: parentProjectId,
          projectName: parentProjectName,
        });

        return {
          statusCode: 201,
          headers: CORS_HEADERS,
          body: JSON.stringify({ message: "Task created successfully", task: newTask }),
        };
      }

      // PATCH /api/tasks/toggle
      if (rawPath === "/api/tasks/toggle" && httpMethod === "PATCH") {
        const payload =
          typeof event.body === "string" ? JSON.parse(event.body || "{}") : event.body || {};
        const { id, chatId, completed } = payload;

        const updated = await Memory.findOneAndUpdate(
          { _id: id, chatId },
          { completed: completed !== undefined ? completed : true },
          { new: true }
        );

        if (!updated) {
          return {
            statusCode: 404,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: "Task not found" }),
          };
        }

        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({ message: "Task updated", task: updated }),
        };
      }

      // DELETE /api/tasks
      if (rawPath === "/api/tasks" && httpMethod === "DELETE") {
        const payload =
          typeof event.body === "string" ? JSON.parse(event.body || "{}") : event.body || {};
        const id = payload.id || queryParams.id;
        const chatId = payload.chatId || queryParams.chatId;

        await Memory.findOneAndDelete({ _id: id, chatId });

        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({ message: "Task deleted" }),
        };
      }

      // GET /api/stats (Admin only)
      if (rawPath === "/api/stats" && httpMethod === "GET") {
        const reqChatId = String(queryParams.chatId || "").trim();
        const configuredAdminId = String(process.env.CHAT_ID || CHAT_ID || "5275149287").trim();

        if (reqChatId !== "5275149287" && reqChatId !== configuredAdminId) {
          return {
            statusCode: 403,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: "Unauthorized access to admin analytics." }),
          };
        }

        const totalUsers = await User.countDocuments();
        const users = await User.find().limit(100);
        const totalTasks = await Memory.countDocuments();
        const pendingTasks = await Memory.countDocuments({ completed: false });
        const completedTasks = await Memory.countDocuments({ completed: true });
        const totalMessages = await History.countDocuments();

        // Also discover any chatIds from History in case any are missing from User collection
        const distinctChatIds = await History.distinct("chatId");
        const knownTelegramIds = new Set(users.map((u) => Number(u.telegramId)));

        const allUserObjects = [...users];
        for (const cid of distinctChatIds) {
          if (cid && !knownTelegramIds.has(Number(cid))) {
            allUserObjects.push({
              telegramId: cid,
              firstName: `User #${cid}`,
              username: "",
              createdAt: new Date(),
            });
          }
        }

        // Enrich users list with message counts & latest message
        const enrichedUsers = await Promise.all(
          allUserObjects.map(async (u) => {
            const msgCount = await History.countDocuments({ chatId: u.telegramId });
            const lastMsg = await History.findOne({ chatId: u.telegramId }).sort({ createdAt: -1 });
            const displayName = u.firstName || u.username || `User #${u.telegramId}`;
            return {
              _id: u._id || `temp_${u.telegramId}`,
              telegramId: u.telegramId,
              firstName: displayName,
              username: u.username || "",
              createdAt: u.createdAt || new Date(),
              messageCount: msgCount,
              lastMessageSnippet: lastMsg
                ? lastMsg.content.slice(0, 50) + (lastMsg.content.length > 50 ? "..." : "")
                : "No messages yet",
              lastActive: lastMsg ? lastMsg.createdAt : u.createdAt || new Date(0),
            };
          })
        );

        // Sort by most recent activity first (Desc)
        enrichedUsers.sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime());

        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            totalUsers: Math.max(totalUsers, enrichedUsers.length),
            totalTasks,
            pendingTasks,
            completedTasks,
            totalMessages,
            users: enrichedUsers,
          }),
        };
      }

      // GET /api/admin/conversations (Owner Only)
      if (rawPath === "/api/admin/conversations" && httpMethod === "GET") {
        const reqChatId = String(queryParams.chatId || "").trim();
        const configuredAdminId = String(process.env.CHAT_ID || CHAT_ID || "5275149287").trim();

        if (reqChatId !== "5275149287" && reqChatId !== configuredAdminId) {
          return {
            statusCode: 403,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: "Unauthorized" }),
          };
        }

        const targetChatId = queryParams.targetChatId;
        if (!targetChatId) {
          return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: "targetChatId parameter is required" }),
          };
        }

        const targetUser = await User.findOne({ telegramId: targetChatId });
        const messages = await History.find({ chatId: targetChatId })
          .sort({ createdAt: 1, _id: 1 })
          .limit(200);

        const safeUser = targetUser
          ? {
              _id: targetUser._id,
              telegramId: targetUser.telegramId,
              firstName: targetUser.firstName || targetUser.username || `User #${targetUser.telegramId}`,
              username: targetUser.username || "",
              photoUrl: targetUser.photoUrl || null,
            }
          : {
              telegramId: targetChatId,
              firstName: `User #${targetChatId}`,
              username: "",
            };

        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            targetUser: safeUser,
            messages,
          }),
        };
      }

      // POST /api/admin/send-message (Live Bot Proxy / Human Takeover with Media)
      if (rawPath === "/api/admin/send-message" && httpMethod === "POST") {
        const payload =
          typeof event.body === "string" ? JSON.parse(event.body || "{}") : event.body || {};
        const reqChatId = String(payload.chatId || payload.ownerId || "").trim();
        const configuredAdminId = String(process.env.CHAT_ID || CHAT_ID || "5275149287").trim();

        if (reqChatId !== "5275149287" && reqChatId !== configuredAdminId) {
          return {
            statusCode: 403,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: "Unauthorized access to admin proxy." }),
          };
        }

        const targetChatId = payload.targetChatId;
        const text = (payload.text || "").trim();
        const mediaBase64 = payload.mediaBase64 || null;
        const mediaType = payload.mediaType || "";
        const fileName = payload.fileName || "";
        const caption = payload.caption || text;
        const hasSpoiler = Boolean(payload.hasSpoiler);

        if (!targetChatId) {
          return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: "targetChatId is required." }),
          };
        }

        let sentMsg = null;
        let recordedContent = text;
        try {
          if (mediaBase64) {
            const cleanBase64 = mediaBase64.replace(/^data:[^;]+;base64,/, "");
            const buffer = Buffer.from(cleanBase64, "base64");

            const isVideo = mediaType.startsWith("video/") || /\.(mp4|mov|webm|mkv|avi)$/i.test(fileName);
            const isImage = mediaType.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp)$/i.test(fileName);

            const mediaOptions = {};
            if (caption) {
              mediaOptions.caption = markdownToTelegramHtml(caption);
              mediaOptions.parse_mode = "HTML";
            }
            if (hasSpoiler) mediaOptions.has_spoiler = true;

            if (isVideo) {
              sentMsg = await bot.telegram.sendVideo(
                targetChatId,
                { source: buffer, filename: fileName || "video.mp4" },
                Object.keys(mediaOptions).length > 0 ? mediaOptions : undefined
              );
              recordedContent = `[Video] ${caption || ""}`.trim();
            } else if (isImage) {
              sentMsg = await bot.telegram.sendPhoto(
                targetChatId,
                { source: buffer, filename: fileName || "image.jpg" },
                Object.keys(mediaOptions).length > 0 ? mediaOptions : undefined
              );
              recordedContent = `[Photo] ${caption || ""}`.trim();
            } else {
              sentMsg = await bot.telegram.sendDocument(
                targetChatId,
                { source: buffer, filename: fileName || "file" },
                caption ? { caption: markdownToTelegramHtml(caption), parse_mode: "HTML" } : undefined
              );
              recordedContent = `[Document: ${fileName || "file"}] ${caption || ""}`.trim();
            }
          } else if (text) {
            try {
              sentMsg = await bot.telegram.sendMessage(targetChatId, markdownToTelegramHtml(text), {
                parse_mode: "HTML",
              });
            } catch (tgFormatErr) {
              sentMsg = await bot.telegram.sendMessage(targetChatId, text);
            }
          } else {
            return {
              statusCode: 400,
              headers: CORS_HEADERS,
              body: JSON.stringify({ error: "Either text, photo, or video is required." }),
            };
          }

          const historyDoc = await History.create({
            chatId: targetChatId,
            role: "assistant",
            content: recordedContent,
            telegramMessageId: sentMsg?.message_id || null,
            hasSpoiler: Boolean(hasSpoiler),
          });

          return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({
              success: true,
              message: "Delivered via Bot",
              history: historyDoc,
              telegramMessageId: sentMsg?.message_id,
            }),
          };
        } catch (botErr) {
          console.error("Failed to send message via bot:", botErr);
          return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: `Bot delivery failed: ${botErr.message}` }),
          };
        }
      }

      // 1.3 ADMIN DELETE MESSAGE ENDPOINT
      if (rawPath.endsWith("/api/admin/delete-message") && httpMethod === "POST") {
        try {
          const body = JSON.parse(event.body || "{}");
          const { ownerId, messageId, chatId, telegramMessageId } = body;

          if (String(ownerId) !== "5275149287") {
            return {
              statusCode: 403,
              headers: CORS_HEADERS,
              body: JSON.stringify({ error: "Unauthorized. Owner clearance required." }),
            };
          }

          if (messageId) {
            await History.findByIdAndDelete(messageId);
          }

          let tgDeleted = false;
          if (chatId && telegramMessageId) {
            try {
              await bot.telegram.deleteMessage(chatId, telegramMessageId);
              tgDeleted = true;
            } catch (tgErr) {
              console.warn("Could not delete message on Telegram:", tgErr.message);
            }
          }

          return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({
              success: true,
              message: "Message deleted successfully",
              telegramDeleted: tgDeleted,
            }),
          };
        } catch (delErr) {
          console.error("Failed to delete message:", delErr);
          return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: `Delete failed: ${delErr.message}` }),
          };
        }
      }

      // 1.4 ADMIN EDIT MESSAGE ENDPOINT
      if (rawPath.endsWith("/api/admin/edit-message") && httpMethod === "POST") {
        try {
          const body = JSON.parse(event.body || "{}");
          const { ownerId, messageId, chatId, telegramMessageId, newText } = body;

          if (String(ownerId) !== "5275149287") {
            return {
              statusCode: 403,
              headers: CORS_HEADERS,
              body: JSON.stringify({ error: "Unauthorized. Owner clearance required." }),
            };
          }

          if (!newText || !newText.trim()) {
            return {
              statusCode: 400,
              headers: CORS_HEADERS,
              body: JSON.stringify({ error: "newText is required." }),
            };
          }

          let updatedDoc = null;
          if (messageId) {
            updatedDoc = await History.findByIdAndUpdate(
              messageId,
              { content: newText.trim() },
              { new: true }
            );
          }

          let tgEdited = false;
          if (chatId && telegramMessageId) {
            try {
              await bot.telegram.editMessageText(chatId, telegramMessageId, undefined, newText.trim());
              tgEdited = true;
            } catch (tgErr) {
              try {
                await bot.telegram.editMessageCaption(chatId, telegramMessageId, undefined, newText.trim());
                tgEdited = true;
              } catch (captionErr) {
                console.warn("Could not edit Telegram message text/caption:", captionErr.message);
              }
            }
          }

          return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({
              success: true,
              message: "Message edited successfully",
              telegramEdited: tgEdited,
              history: updatedDoc,
            }),
          };
        } catch (editErr) {
          console.error("Failed to edit message:", editErr);
          return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: `Edit failed: ${editErr.message}` }),
          };
        }
      }

      // 1.5 ADMIN ALERTS / NOTIFICATIONS ENDPOINTS
      if (rawPath.endsWith("/api/admin/alerts") && httpMethod === "GET") {
        try {
          const alerts = await Alert.find().sort({ createdAt: -1 }).limit(30);
          const unreadCount = await Alert.countDocuments({ isRead: false });

          return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({ ok: true, alerts, unreadCount }),
          };
        } catch (alertErr) {
          console.error("Failed to fetch alerts:", alertErr);
          return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: `Alerts fetch failed: ${alertErr.message}` }),
          };
        }
      }

      if (rawPath.endsWith("/api/admin/alerts/mark-read") && httpMethod === "POST") {
        try {
          await Alert.updateMany({ isRead: false }, { isRead: true });
          return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({ ok: true, message: "Alerts marked as read" }),
          };
        } catch (markErr) {
          console.error("Failed to mark alerts as read:", markErr);
          return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: `Alerts mark-read failed: ${markErr.message}` }),
          };
        }
      }

      // 1.6 ADMIN MEME APPROVAL / REJECTION ACTION
      if (rawPath.endsWith("/api/admin/meme-action") && httpMethod === "POST") {
        try {
          const payload = typeof event.body === "string" ? JSON.parse(event.body || "{}") : event.body || {};
          const { requestId, action } = payload;
          const isApproved = action === "approve";

          const { processMemeApproval } = require("../services/memeService");
          const result = await processMemeApproval(bot, requestId, isApproved);

          return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({ ok: true, result }),
          };
        } catch (memeErr) {
          console.error("Failed to process meme action:", memeErr);
          return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: `Meme action failed: ${memeErr.message}` }),
          };
        }
      }

      // 1.7 DIRECT QUICK-CAST RANDOM MEME API
      if (rawPath.endsWith("/api/admin/send-random-meme") && httpMethod === "POST") {
        try {
          const payload = typeof event.body === "string" ? JSON.parse(event.body || "{}") : event.body || {};
          const { targetChatId } = payload;
          if (!targetChatId) {
            return {
              statusCode: 400,
              headers: CORS_HEADERS,
              body: JSON.stringify({ error: "targetChatId is required." }),
            };
          }

          const { sendRandomMemeToChat } = require("../services/memeService");
          const result = await sendRandomMemeToChat(bot, targetChatId);

          return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({ ok: true, result }),
          };
        } catch (memeErr) {
          console.error("Failed to quick-cast random meme:", memeErr);
          return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: `Quick-cast meme failed: ${memeErr.message}` }),
          };
        }
      }
    }

    // -------------------------------------------------------------
    // 2. AWS EVENTBRIDGE TRIGGER (Scheduled Crons)
    // -------------------------------------------------------------
    if (
      event.source === "aws.events" ||
      event["detail-type"] === "Scheduled Event" ||
      event.cron
    ) {
      if (event.task === "dailySummary") {
        await sendDailySummary(bot);
      } else if (event.task === "nightlyReflection") {
        await sendNightlyReflection(bot);
      } else {
        await checkUpcomingReminders(bot);
      }

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: "Scheduled task executed" }),
      };
    }

    // -------------------------------------------------------------
    // 3. TELEGRAM WEBHOOK (Incoming Telegram Messages)
    // -------------------------------------------------------------
    if (event.body) {
      let body;
      try {
        body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
      } catch (e) {
        body = null;
      }

      if (body && (body.update_id || body.callback_query || body.message || body.channel_post)) {
        await bot.handleUpdate(body);
        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({ message: "Update processed" }),
        };
      }
    }

    // Health check ping
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ status: "AtharvaOS Lambda & Web API is online 🚀" }),
    };
  } catch (error) {
    console.error("Lambda error:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
