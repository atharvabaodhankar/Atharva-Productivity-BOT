require("dotenv").config();
const http = require("http");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { BOT_TOKEN, MONGO_URI } = require("./src/config/env");

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

const historySchema = new mongoose.Schema(
  {
    chatId: Number,
    role: String,
    content: String,
  },
  { timestamps: true }
);
const History = mongoose.models.History || mongoose.model("History", historySchema);
const Alert = require("./src/models/Alert");

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

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    return res.end();
  }

  // 1. Direct Telegram Media Upload API
  if (req.url === "/api/local-upload" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", async () => {
      try {
        const payload = JSON.parse(body || "{}");
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
          const blob = new Blob([buffer], { type: mediaType || (isVideo ? "video/mp4" : "image/jpeg") });

          if (isVideo) {
            telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`;
            formData.append("video", blob, fileName || "video.mp4");
            if (hasSpoiler) formData.append("has_spoiler", "true");
          } else if (isPhoto) {
            telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;
            formData.append("photo", blob, fileName || "photo.jpg");
            if (hasSpoiler) formData.append("has_spoiler", "true");
          } else {
            telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`;
            formData.append("document", blob, fileName || "document");
          }

          if (caption || text) {
            formData.append("caption", caption || text);
          }
        } else {
          telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
          formData.append("text", text);
        }

        // Transmit to Telegram API
        const tgRes = await fetch(telegramApiUrl, {
          method: "POST",
          body: formData,
        });

        const tgData = await tgRes.json();

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
        console.error("Upload server error:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // 2. Direct Telegram Message Deletion API
  if (req.url === "/api/local-delete-message" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", async () => {
      try {
        const payload = JSON.parse(body || "{}");
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
        console.error("Delete server error:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // 3. Direct Telegram Message Edit API
  if (req.url === "/api/local-edit-message" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", async () => {
      try {
        const payload = JSON.parse(body || "{}");
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
        console.error("Edit server error:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // 4. Admin Security & Easter Egg Alerts API
  if (req.url === "/api/admin/alerts" && req.method === "GET") {
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

  if (req.url === "/api/admin/alerts/mark-read" && req.method === "POST") {
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

  // 5. Static File Server
  let filePath = path.join(ADMIN_DIR, req.url === "/" ? "index.html" : req.url.split("?")[0]);
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
