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
    .connect(MONGO_URI)
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
        const { targetChatId, text = "", mediaBase64, mediaType = "", fileName = "media", caption = "" } = payload;

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
          } else if (isPhoto) {
            telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;
            formData.append("photo", blob, fileName || "photo.jpg");
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

        await History.create({
          chatId: targetChatId,
          role: "assistant",
          content: recordedContent,
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            ok: true,
            message: "Delivered to Telegram successfully!",
            telegramResult: tgData.result,
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

  // 2. Static File Server
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
