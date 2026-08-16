require("dotenv").config();
const http = require("http");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { BOT_TOKEN, MONGO_URI } = require("./src/config/env");
const History = require("./src/models/History");
const Alert = require("./src/models/Alert");
const { markdownToTelegramHtml } = require("./src/utils/telegramFormatter");

const PORT = process.env.PORT || 4000;
const ADMIN_DIR = path.join(__dirname, "admin-console");

// Connect to MongoDB
if (MONGO_URI) {
  mongoose
    .connect(MONGO_URI, {
      maxPoolSize: 2,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 5000,
    })
    .then(() => console.log("📦 MongoDB connected to Local Admin Server"))
    .catch((err) => console.warn("MongoDB connection error in admin server:", err.message));
}


const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".mp4": "video/mp4",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

// Helper to safely parse JSON body with strict size limit (DoS prevention)
function readJsonBody(req, res, maxBytes = 35 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = "";
    let receivedBytes = 0;

    req.on("data", (chunk) => {
      receivedBytes += chunk.length;
      if (receivedBytes > maxBytes) {
        req.destroy();
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "Payload Too Large (Exceeds limit)" }));
        reject(new Error("Payload Too Large"));
        return;
      }
      body += chunk;
    });

    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "Invalid JSON format" }));
        reject(err);
      }
    });

    req.on("error", (err) => reject(err));
  });
}

const server = http.createServer(async (req, res) => {
  // CORS Headers
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-secret, X-Admin-Secret");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    return res.end();
  }

  // 0. AUTHENTICATION CLEARANCE GATE
  const { ADMIN_SECRET } = require("./src/config/env");
  const expectedSecret = process.env.ADMIN_SECRET || ADMIN_SECRET;
  
  let reqSecret = req.headers["x-admin-secret"] || req.headers["X-Admin-Secret"];
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (!reqSecret) reqSecret = parsedUrl.searchParams.get("admin_secret");
  } catch (e) {}

  if (req.url.startsWith("/api/")) {
    if (!expectedSecret || reqSecret !== expectedSecret) {
      res.writeHead(401, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Unauthorized. Invalid or missing x-admin-secret header." }));
    }

    // 1. Direct Telegram Media Upload API
    if ((req.url.startsWith("/api/local-upload") || req.url.startsWith("/api/admin/send-message")) && req.method === "POST") {
      try {
        const payload = await readJsonBody(req, res);
        const {
          targetChatId,
          text = "",
          mediaBase64,
          mediaType = "",
          fileName = "media",
          caption = "",
          hasSpoiler = false,
        } = payload;

        if (!targetChatId) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ ok: false, error: "targetChatId is required." }));
        }

        if (!mediaBase64 && !text) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ ok: false, error: "Text or media is required." }));
        }

        const isVideo = mediaType.startsWith("video/") || /\.(mp4|mov|webm|mkv|avi)$/i.test(fileName);
        const isPhoto = mediaType.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp)$/i.test(fileName);

        let telegramApiUrl = "";
        let formData = new FormData();
        formData.append("chat_id", String(targetChatId));

        if (mediaBase64) {
          const cleanBase64 = mediaBase64.replace(/^data:[^;]+;base64,/, "");
          const buffer = Buffer.from(cleanBase64, "base64");
          const mime = mediaType || (isVideo ? "video/mp4" : "image/jpeg");
          const file = new File([buffer], fileName || (isVideo ? "video.mp4" : "photo.jpg"), { type: mime });

          if (isVideo) {
            telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`;
            formData.append("video", file);
            if (hasSpoiler) formData.append("has_spoiler", "true");
          } else if (isPhoto) {
            telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;
            formData.append("photo", file);
            if (hasSpoiler) formData.append("has_spoiler", "true");
          } else {
            telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`;
            formData.append("document", file);
          }

          if (caption || text) {
            formData.append("caption", markdownToTelegramHtml(caption || text));
            formData.append("parse_mode", "HTML");
          }
        } else {
          telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
          formData.append("text", markdownToTelegramHtml(text));
          formData.append("parse_mode", "HTML");
        }

        // Transmit to Telegram API
        let tgRes = await fetch(telegramApiUrl, {
          method: "POST",
          body: formData,
        });

        let tgData = await tgRes.json();

        // Automatic Fallback: If Telegram HTML entity parsing fails, retry delivering plain text
        if (!tgData.ok && (tgData.description || "").toLowerCase().includes("parse")) {
          console.warn("Telegram HTML parse_mode error, retrying delivery with plain text fallback...");
          const plainFormData = new FormData();
          plainFormData.append("chat_id", String(targetChatId));
          plainFormData.append("text", text || caption || "Hello!");

          tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: "POST",
            body: plainFormData,
          });
          tgData = await tgRes.json();
        }

        if (!tgData.ok) {
          console.error("Telegram API Error:", tgData);
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(
            JSON.stringify({
              ok: false,
              error: tgData.description || "Telegram API rejected the upload.",
            })
          );
        }

        // Record in MongoDB History
        const recordedContent = mediaBase64
          ? (isVideo ? `[Video] ${caption || text}` : `[Photo] ${caption || text}`).trim()
          : text;

        const historyDoc = await History.create({
          chatId: targetChatId,
          role: "assistant",
          content: recordedContent,
          telegramMessageId: tgData.result?.message_id || null,
          hasSpoiler: Boolean(hasSpoiler),
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            ok: true,
            message: "Delivered to Telegram successfully!",
            telegramResult: tgData.result,
            history: historyDoc,
          })
        );
      } catch (err) {
        if (res.writableEnded) return;
        console.error("Upload server error:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    }

    // 2. Direct Telegram Message Deletion API
    if ((req.url.startsWith("/api/local-delete-message") || req.url.startsWith("/api/admin/delete-message")) && req.method === "POST") {
      try {
        const payload = await readJsonBody(req, res);
        const { messageId, chatId, telegramMessageId } = payload;

        if (messageId) {
          await History.findByIdAndDelete(messageId);
        }

        let tgDeleted = false;
        if (chatId && telegramMessageId) {
          try {
            const delRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: String(chatId),
                message_id: Number(telegramMessageId),
              }),
            });
            const delData = await delRes.json();
            tgDeleted = delData.ok || false;
          } catch (tgErr) {
            console.warn("Telegram delete error:", tgErr.message);
          }
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            ok: true,
            message: "Message deleted successfully",
            telegramDeleted: tgDeleted,
          })
        );
      } catch (err) {
        if (res.writableEnded) return;
        console.error("Delete server error:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    }

    // 3. Direct Telegram Message Edit API
    if ((req.url.startsWith("/api/local-edit-message") || req.url.startsWith("/api/admin/edit-message")) && req.method === "POST") {
      try {
        const payload = await readJsonBody(req, res);
        const { messageId, chatId, telegramMessageId, newText } = payload;

        if (!newText || !newText.trim()) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ ok: false, error: "newText is required." }));
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
            // First try editing as text message
            const editRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: String(chatId),
                message_id: Number(telegramMessageId),
                text: newText.trim(),
              }),
            });
            const editData = await editRes.json();
            if (editData.ok) {
              tgEdited = true;
            } else {
              // If it was a photo/video caption, edit caption!
              const captionRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageCaption`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: String(chatId),
                  message_id: Number(telegramMessageId),
                  caption: newText.trim(),
                }),
              });
              const captionData = await captionRes.json();
              tgEdited = captionData.ok || false;
            }
          } catch (tgErr) {
            console.warn("Telegram edit error:", tgErr.message);
          }
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            ok: true,
            message: "Message updated successfully",
            telegramEdited: tgEdited,
            history: updatedDoc,
          })
        );
      } catch (err) {
        if (res.writableEnded) return;
        console.error("Edit server error:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    }

    // 4. Admin Security & Easter Egg Alerts API
    if (req.url.startsWith("/api/admin/alerts") && !req.url.includes("mark-read") && req.method === "GET") {
      try {
        const alerts = await Alert.find().sort({ createdAt: -1 }).limit(30);
        const unreadCount = await Alert.countDocuments({ isRead: false });

        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: true, alerts, unreadCount }));
      } catch (err) {
        console.error("Alerts fetch error:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    }

    if (req.url.startsWith("/api/admin/alerts/mark-read") && req.method === "POST") {
      try {
        await Alert.updateMany({ isRead: false }, { isRead: true });
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: true, message: "All alerts marked as read" }));
      } catch (err) {
        console.error("Alerts mark-read error:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    }

    // 5. Admin Meme Approval / Rejection API
    if (req.url.startsWith("/api/admin/meme-action") && req.method === "POST") {
      try {
        const payload = await readJsonBody(req, res);
        const { requestId, action } = payload;
        const isApproved = action === "approve";

        const bot = require("./src/bot");
        const { processMemeApproval } = require("./src/services/memeService");
        const result = await processMemeApproval(bot, requestId, isApproved);

        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: true, result }));
      } catch (err) {
        if (res.writableEnded) return;
        console.error("Meme action error:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    }

    // 6. Direct Quick-Cast Random Meme API
    if (req.url.startsWith("/api/admin/send-random-meme") && req.method === "POST") {
      try {
        const payload = await readJsonBody(req, res);
        const { targetChatId } = payload;
        if (!targetChatId) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ ok: false, error: "targetChatId is required." }));
        }

        const bot = require("./src/bot");
        const { sendRandomMemeToChat } = require("./src/services/memeService");
        const result = await sendRandomMemeToChat(bot, targetChatId);

        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: true, result }));
      } catch (err) {
        if (res.writableEnded) return;
        console.error("send-random-meme error:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    }
  }

  // 7. GET /api/stats (Local User Directory Fetch)
  if (req.url.startsWith("/api/stats") && req.method === "GET") {
    try {
      const User = require("./src/models/User");
      const usersDocs = await User.find().lean();

      const users = await Promise.all(
        usersDocs.map(async (u) => {
          const count = await History.countDocuments({ chatId: u.telegramId });
          const lastMsg = await History.findOne({ chatId: u.telegramId }).sort({ createdAt: -1 });
          const lastActiveTime = lastMsg ? lastMsg.createdAt : (u.updatedAt || u.createdAt);
          return {
            telegramId: u.telegramId,
            firstName: u.firstName || "User",
            username: u.username || "",
            messageCount: count,
            lastActive: lastActiveTime,
            lastMessageSnippet: lastMsg ? lastMsg.content : "No messages yet",
          };
        })
      );

      // Sort users by most recent activity timestamp descending (most recent on top)
      users.sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime());

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, users }));
    } catch (err) {
      console.error("Local stats fetch error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: err.message }));
    }
  }

  // 8. GET /api/admin/conversations (or /api/conversations)
  if (
    (req.url.startsWith("/api/admin/conversations") || req.url.startsWith("/api/conversations")) &&
    req.method === "GET"
  ) {
    try {
      const urlObj = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const targetChatId = urlObj.searchParams.get("targetChatId") || urlObj.searchParams.get("chatId");

      if (!targetChatId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: "targetChatId is required." }));
      }

      const messages = await History.find({ chatId: Number(targetChatId) })
        .sort({ createdAt: 1 })
        .limit(200);

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, messages }));
    } catch (err) {
      console.error("Local conversations fetch error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: err.message }));
    }
  }

  // 5. Static File Server with Path Traversal Guard
  const rawUrlPath = req.url.split("?")[0];
  const normalizedPath = path.normalize(rawUrlPath).replace(/^(\.\.[\/\\])+/, "");
  const relativeFile = normalizedPath === "/" || normalizedPath === "\\" ? "index.html" : normalizedPath;
  const filePath = path.resolve(ADMIN_DIR, `.${path.sep}${relativeFile}`);

  // Strict Path Traversal Guard: Resolved path must remain inside ADMIN_DIR
  if (!filePath.startsWith(ADMIN_DIR)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    return res.end("403 Forbidden");
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === "ENOENT") {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("404 Not Found");
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content, "utf-8");
    }
  });
});

server.listen(PORT, () => {
  console.log("\n=======================================================");
  console.log(`🚀 AtharvaOS Monochrome Mission Control is LIVE!`);
  console.log(`🌐 Open in Browser: http://localhost:${PORT}`);
  console.log("=======================================================\n");
});
