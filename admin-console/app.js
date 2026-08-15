// AtharvaOS // Monochrome Bot POV Console Controller (Zero-Flicker Live Engine & Direct Media Uploader)

const IS_LOCAL_DEV =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "0.0.0.0" ||
  window.location.port === "4000" ||
  window.location.port === "5500";

const REMOTE_API_BASE = "https://ged2lb24hngndlzk5b73dmvdqy0ydsmo.lambda-url.ap-south-1.on.aws/api";
const OWNER_CHAT_ID = "5275149287";

// Helper to resolve API endpoint seamlessly across Local Node Server (port 4000 / Live Server) & Production Lambda
function getApiUrl(path) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (IS_LOCAL_DEV) {
    const localHost = window.location.port === "4000" ? "" : "http://localhost:4000";
    return `${localHost}${cleanPath.startsWith("/api") ? cleanPath : `/api${cleanPath}`}`;
  }
  return `${REMOTE_API_BASE}${cleanPath.replace(/^\/api/, "")}`;
}

// State
let allUsers = [];
let lastUsersSignature = "";
let activeTargetUser = null;
let activeMessages = [];
let stagedMediaBase64 = null;
let stagedMediaFileName = "";
let stagedMediaType = "";
let isSpoilerActive = false;
let isAutoPollActive = true;
let unreadAlertsCount = 0;
let lastAlertsCount = 0;

// DOM Elements
const usersListEl = document.getElementById("usersListEl");
const userSearchInput = document.getElementById("userSearchInput");
const refreshUsersBtn = document.getElementById("refreshUsersBtn");

const activeAvatar = document.getElementById("activeAvatar");
const activeUserName = document.getElementById("activeUserName");
const activeUserHandle = document.getElementById("activeUserHandle");
const activeUserMeta = document.getElementById("activeUserMeta");
const liveClock = document.getElementById("liveClock");
const autoPollToggleBtn = document.getElementById("autoPollToggleBtn");
const manualRefreshBtn = document.getElementById("manualRefreshBtn");

const messagesStreamEl = document.getElementById("messagesStreamEl");
const chatMessageInput = document.getElementById("chatMessageInput");
const sendBtn = document.getElementById("sendBtn");

const attachMediaBtn = document.getElementById("attachMediaBtn");
const mediaFileInput = document.getElementById("mediaFileInput");
const mediaPreviewBar = document.getElementById("mediaPreviewBar");
const mediaPreviewThumb = document.getElementById("mediaPreviewThumb");
const mediaPreviewName = document.getElementById("mediaPreviewName");
const mediaPreviewMeta = document.getElementById("mediaPreviewMeta");
const removeMediaBtn = document.getElementById("clearMediaBtn") || document.getElementById("removeMediaBtn");
const toggleSpoilerBtn = document.getElementById("toggleSpoilerBtn");
const dragDropOverlay = document.getElementById("dragDropOverlay");

const toastContainer = document.getElementById("toastContainer");
const alertsToggleBtn = document.getElementById("alertsToggleBtn");
const alertsBadgeCount = document.getElementById("alertsBadgeCount");
const alertsModalOverlay = document.getElementById("alertsModalOverlay");
const closeAlertsModalBtn = document.getElementById("closeAlertsModalBtn");
const markAlertsReadBtn = document.getElementById("markAlertsReadBtn");
const alertsListBody = document.getElementById("alertsListBody");

// ------------------------------------------------------------------
// HELPER FUNCTIONS & UI UTILITIES
// ------------------------------------------------------------------

// Toast Notification Engine
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  const iconName = type === "success" ? "check-circle" : type === "error" ? "alert-triangle" : "info";
  toast.innerHTML = `
    <i data-lucide="${iconName}"></i>
    <span>${escapeHtml(message)}</span>
  `;

  toastContainer.appendChild(toast);
  refreshIcons();

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-10px)";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Refresh Lucide Icons safely
function refreshIcons() {
  if (window.lucide) {
    lucide.createIcons();
  }
}

// HTML Escaper to prevent XSS
function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Time Formatting
function formatTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);

  if (diffSec < 45) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// 1. Fetch Users List (With Zero-Flicker Diff Check)
async function fetchUsers() {
  try {
    const res = await fetch(getApiUrl(`/stats?chatId=${OWNER_CHAT_ID}`));
    const data = await res.json();

    if (data && data.users) {
      const newSignature = data.users
        .map((u) => `${u.telegramId}-${u.messageCount}-${u.lastActive}-${u.lastMessageSnippet}`)
        .join("|");

      allUsers = data.users;

      if (newSignature !== lastUsersSignature) {
        lastUsersSignature = newSignature;
        renderUsersList();
      }
    }
  } catch (err) {
    console.error("Failed to load user threads:", err);
  }
}

// 2. Render Users Directory
function renderUsersList() {
  const query = userSearchInput.value.toLowerCase().trim();
  const filtered = allUsers.filter((u) => {
    const name = (u.firstName || "").toLowerCase();
    const handle = (u.username || "").toLowerCase();
    const id = String(u.telegramId || "");
    return !query || name.includes(query) || handle.includes(query) || id.includes(query);
  });

  if (filtered.length === 0) {
    usersListEl.innerHTML = `<div style="color:var(--text-muted); font-size:0.8rem; padding: 12px; text-align:center;">No matching threads found</div>`;
    return;
  }

  usersListEl.innerHTML = filtered
    .map((u) => {
      const displayName = u.firstName || (u.username ? `@${u.username}` : `User #${u.telegramId}`);
      const handleDisplay = u.username ? `@${u.username}` : `ID: ${u.telegramId}`;
      const isActive = activeTargetUser && activeTargetUser.telegramId === u.telegramId;
      const initials = (u.firstName || "U").substring(0, 2).toUpperCase();

      return `
        <div class="user-item-card ${isActive ? "active" : ""}" data-id="${u.telegramId}">
          <div class="user-avatar-mini">${initials}</div>
          <div class="user-info-body">
            <div class="user-top-row">
              <span class="user-display-name">${escapeHtml(displayName)}</span>
              <span class="user-last-time">${formatRelativeTime(u.lastActive)}</span>
            </div>
            <div class="user-sub-row">
              <span class="user-snippet">${escapeHtml(u.lastMessageSnippet || "No messages yet")}</span>
              <span class="user-msg-count">${u.messageCount || 0}</span>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  usersListEl.querySelectorAll(".user-item-card").forEach((card) => {
    card.addEventListener("click", () => {
      const targetId = Number(card.dataset.id);
      const targetUser = allUsers.find((u) => u.telegramId === targetId);
      if (targetUser) {
        selectUserThread(targetUser);
      }
    });
  });
}

// Select User Thread
function selectUserThread(user) {
  activeTargetUser = user;
  renderUsersList();

  activeAvatar.textContent = (user.firstName || "U").substring(0, 2).toUpperCase();
  activeUserName.textContent = user.firstName || "User";
  activeUserHandle.textContent = user.username ? `@${user.username}` : `ID: ${user.telegramId}`;
  activeUserMeta.textContent = `TELEGRAM ID: ${user.telegramId} // ACTIVE NOW`;

  chatMessageInput.focus();
  loadConversationMessages(true);
}

// Markdown Formatter for Chat Bubbles
function formatMarkdownToHtml(text) {
  if (!text) return "";
  let html = escapeHtml(String(text));

  html = html.replace(/```([\s\S]*?)```/g, '<pre style="background:rgba(0,0,0,0.4); padding:8px 12px; border-radius:6px; font-family:var(--font-mono); font-size:0.82rem; margin:6px 0; overflow-x:auto;">$1</pre>');
  html = html.replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.3); padding:2px 6px; border-radius:4px; font-family:var(--font-mono); font-size:0.82rem; color:var(--accent-cyan);">$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong style="color:var(--text-pure-white); font-weight:700;">$1</strong>');
  html = html.replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1<strong style="color:var(--text-pure-white); font-weight:700;">$2</strong>$3');
  html = html.replace(/(^|[^_])_([^_]+)_([^_]|$)/g, '$1<em>$2</em>$3');
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:var(--accent-cyan); text-decoration:underline;">$1</a>');
  html = html.replace(/\n/g, "<br>");

  return html;
}

// Create single message DOM element
function createMessageNode(msg) {
  const isUser = msg.role === "user";
  const rowEl = document.createElement("div");
  rowEl.className = `msg-row ${isUser ? "user-msg" : "bot-msg"}`;
  rowEl.dataset.id = msg._id || "";

  const timeStr = formatTime(msg.createdAt);
  const senderTag = isUser ? `@${activeTargetUser?.username || activeTargetUser?.firstName || "User"}` : "AtharvaOS (Bot POV)";
  const spoilerBadge = msg.hasSpoiler ? `<span class="spoiler-badge"><i data-lucide="eye-off"></i> SPOILER</span>` : "";

  let actionToolbar = "";
  if (!isUser) {
    actionToolbar = `
      <div class="msg-actions-bar">
        <button class="msg-action-btn edit-btn" title="Edit Message Content">
          <i data-lucide="edit-3"></i>
        </button>
        <button class="msg-action-btn delete-btn" title="Delete Message from Chat & Telegram">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    `;
  }

  rowEl.innerHTML = `
    <div class="msg-sender-meta">${senderTag} ${spoilerBadge}</div>
    <div class="msg-content-wrapper">
      <div class="msg-card">
        <div class="msg-text">${formatMarkdownToHtml(msg.content)}</div>
        <div class="msg-time">${timeStr}</div>
      </div>
      ${actionToolbar}
    </div>
  `;

  if (!isUser) {
    const editBtn = rowEl.querySelector(".edit-btn");
    const deleteBtn = rowEl.querySelector(".delete-btn");

    if (editBtn) {
      editBtn.addEventListener("click", () => openEditMessageModal(msg, rowEl));
    }
    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => deleteAdminMessage(msg, rowEl));
    }
  }

  return rowEl;
}

// Edit Message Inline Editor Modal
function openEditMessageModal(msg, rowEl) {
  const cardEl = rowEl.querySelector(".msg-card");
  const textEl = rowEl.querySelector(".msg-text");
  const oldText = msg.content;

  cardEl.innerHTML = `
    <textarea class="inline-edit-textarea" rows="3">${escapeHtml(oldText)}</textarea>
    <div class="inline-edit-actions">
      <button class="inline-btn cancel">Cancel</button>
      <button class="inline-btn save">Save Changes</button>
    </div>
  `;

  const textarea = cardEl.querySelector(".inline-edit-textarea");
  const cancelBtn = cardEl.querySelector(".cancel");
  const saveBtn = cardEl.querySelector(".save");

  textarea.focus();

  cancelBtn.addEventListener("click", () => {
    cardEl.innerHTML = `
      <div class="msg-text">${formatMarkdownToHtml(oldText)}</div>
      <div class="msg-time">${formatTime(msg.createdAt)}</div>
    `;
  });

  saveBtn.addEventListener("click", async () => {
    const newText = textarea.value.trim();
    if (!newText) {
      return showToast("Message content cannot be empty", "error");
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
      const res = await fetch(getApiUrl("/local-edit-message"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: msg._id,
          chatId: activeTargetUser ? activeTargetUser.telegramId : null,
          telegramMessageId: msg.telegramMessageId,
          newText,
        }),
      });

      const data = await res.json();
      if (data.ok || data.success) {
        msg.content = newText;
        cardEl.innerHTML = `
          <div class="msg-text">${formatMarkdownToHtml(newText)}</div>
          <div class="msg-time">${formatTime(msg.createdAt)}</div>
        `;
        showToast("✏️ Message updated on Telegram & transcript!", "success");
      } else {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Changes";
        showToast(`⚠️ Edit failed: ${data.error || "Unknown error"}`, "error");
      }
    } catch (err) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Changes";
      showToast("❌ Network error saving edit.", "error");
    }
  });
}

// Delete Message from Transcript & Telegram
async function deleteAdminMessage(msg, rowEl) {
  if (!confirm("Are you sure you want to delete this message? It will be removed from the conversation and Telegram.")) {
    return;
  }

  rowEl.classList.add("deleting");

  try {
    const res = await fetch(getApiUrl("/local-delete-message"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ownerId: OWNER_CHAT_ID,
        messageId: msg._id,
        chatId: activeTargetUser ? activeTargetUser.telegramId : null,
        telegramMessageId: msg.telegramMessageId,
      }),
    });

    const data = await res.json();
    if (data.ok || data.success) {
      setTimeout(() => {
        rowEl.remove();
        activeMessages = activeMessages.filter((m) => m._id !== msg._id);
        showToast("🗑️ Message deleted from transcript & Telegram!", "success");
      }, 250);
    } else {
      rowEl.classList.remove("deleting");
      showToast(`⚠️ Delete failed: ${data.error || "Unknown error"}`, "error");
    }
  } catch (err) {
    rowEl.classList.remove("deleting");
    showToast("❌ Network error deleting message.", "error");
  }
}

// Load Conversation Messages
async function loadConversationMessages(isInitialSelect = false) {
  if (!activeTargetUser) return;

  try {
    const res = await fetch(
      getApiUrl(`/admin/conversations?chatId=${OWNER_CHAT_ID}&targetChatId=${activeTargetUser.telegramId}`)
    );
    const data = await res.json();

    if (data && data.messages) {
      const incomingMessages = (data.messages || []).sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        if (timeA !== timeB) return timeA - timeB;
        if (a.role === "user" && b.role === "assistant") return -1;
        if (a.role === "assistant" && b.role === "user") return 1;
        return (a._id || "").localeCompare(b._id || "");
      });

      if (isInitialSelect) {
        messagesStreamEl.innerHTML = "";
        activeMessages = incomingMessages;
        incomingMessages.forEach((msg) => {
          messagesStreamEl.appendChild(createMessageNode(msg));
        });
        refreshIcons();
        messagesStreamEl.scrollTop = messagesStreamEl.scrollHeight;
        return;
      }

      // Smart Diff Check
      const existingIds = new Set(activeMessages.map((m) => m._id));
      const newMsgs = incomingMessages.filter((m) => !existingIds.has(m._id));

      if (newMsgs.length > 0) {
        newMsgs.forEach((msg) => {
          activeMessages.push(msg);
          messagesStreamEl.appendChild(createMessageNode(msg));
        });
        refreshIcons();
        messagesStreamEl.scrollTop = messagesStreamEl.scrollHeight;
      }
    }
  } catch (err) {
    console.error("Failed to load conversation messages:", err);
  }
}

// ------------------------------------------------------------------
// MEDIA ATTACHMENT & DRAG AND DROP ENGINE
// ------------------------------------------------------------------

function stageMediaFile(file) {
  if (!file) return;

  const isValidType = file.type.startsWith("image/") || file.type.startsWith("video/");
  if (!isValidType) {
    return showToast("Only Photo (PNG/JPG/WEBP/GIF) or Video (MP4/MOV/WEBM) files are supported.", "error");
  }

  if (file.size > 25 * 1024 * 1024) {
    return showToast("File size exceeds 25MB limit.", "error");
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    stagedMediaBase64 = e.target.result;
    stagedMediaFileName = file.name;
    stagedMediaType = file.type;

    mediaPreviewName.textContent = file.name;
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    mediaPreviewMeta.textContent = `${file.type.toUpperCase()} // ${sizeMb} MB`;

    if (file.type.startsWith("image/")) {
      mediaPreviewThumb.src = stagedMediaBase64;
    } else {
      mediaPreviewThumb.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='%2523f59e0b' stroke-width='2'><path d='m22 8-6 4 6 4V8Z'/><rect width='14' height='12' x='2' y='6' rx='2'/></svg>";
    }

    mediaPreviewBar.style.display = "flex";
    showToast(`📸 Media staged: ${file.name}`, "success");
  };

  reader.readAsDataURL(file);
}

function clearStagedMedia() {
  stagedMediaBase64 = null;
  stagedMediaFileName = "";
  stagedMediaType = "";
  mediaFileInput.value = "";
  mediaPreviewBar.style.display = "none";
}

if (attachMediaBtn && mediaFileInput) {
  attachMediaBtn.addEventListener("click", () => mediaFileInput.click());
}
if (mediaFileInput) {
  mediaFileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      stageMediaFile(e.target.files[0]);
    }
  });
}
if (removeMediaBtn) {
  removeMediaBtn.addEventListener("click", clearStagedMedia);
}

if (toggleSpoilerBtn) {
  toggleSpoilerBtn.addEventListener("click", () => {
    isSpoilerActive = !isSpoilerActive;
    toggleSpoilerBtn.classList.toggle("active", isSpoilerActive);
    showToast(isSpoilerActive ? "👁️‍🗨️ Spoiler mode ENABLED for media" : "👁️ Spoiler mode DISABLED", "info");
  });
}

// Drag & Drop
if (dragDropOverlay) {
  window.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (activeTargetUser) dragDropOverlay.style.display = "flex";
  });

  dragDropOverlay.addEventListener("dragleave", (e) => {
    e.preventDefault();
    dragDropOverlay.style.display = "none";
  });

  window.addEventListener("drop", (e) => {
    e.preventDefault();
    dragDropOverlay.style.display = "none";
    if (activeTargetUser && e.dataTransfer.files && e.dataTransfer.files[0]) {
      stageMediaFile(e.dataTransfer.files[0]);
    }
  });
}

// ------------------------------------------------------------------
// MESSAGE TRANSMISSION ENGINE (Proxy Bot POV Dispatch)
// ------------------------------------------------------------------

async function sendMessage() {
  if (!activeTargetUser) {
    return showToast("Please select a target user thread from the left directory first.", "error");
  }

  const text = chatMessageInput.value.trim();
  if (!text && !stagedMediaBase64) {
    return showToast("Please enter a text message or attach a media file.", "error");
  }

  sendBtn.disabled = true;
  sendBtn.innerHTML = `<span class="upload-spinner"></span>`;

  const payload = {
    ownerId: OWNER_CHAT_ID,
    targetChatId: activeTargetUser.telegramId,
    text: text,
    caption: text,
    mediaBase64: stagedMediaBase64,
    mediaType: stagedMediaType,
    fileName: stagedMediaFileName,
    hasSpoiler: isSpoilerActive,
  };

  try {
    const res = await fetch(getApiUrl("/local-upload"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (data.ok || data.success) {
      chatMessageInput.value = "";
      chatMessageInput.style.height = "auto";
      clearStagedMedia();
      showToast("🚀 Transmitted to Telegram successfully!", "success");

      await loadConversationMessages(true);
      await fetchUsers();
    } else {
      showToast(`⚠️ Delivery failed: ${data.error || "Telegram API Error"}`, "error");
    }
  } catch (err) {
    console.error("Message send error:", err);
    showToast("❌ Network error delivering message.", "error");
  } finally {
    sendBtn.disabled = false;
    sendBtn.innerHTML = `<i data-lucide="arrow-up"></i>`;
    refreshIcons();
  }
}

// ------------------------------------------------------------------
// EASTER EGG & SECURITY ALERTS SYSTEM
// ------------------------------------------------------------------

let cachedAlerts = [];

async function fetchAlerts() {
  try {
    const res = await fetch(getApiUrl("/admin/alerts"));
    const data = await res.json();

    if (data.ok || data.alerts) {
      cachedAlerts = data.alerts || [];
      unreadAlertsCount = data.unreadCount || 0;

      if (alertsBadgeCount) {
        if (unreadAlertsCount > 0) {
          alertsBadgeCount.textContent = `${unreadAlertsCount} NEW`;
          alertsBadgeCount.style.display = "inline-block";
          alertsToggleBtn.classList.add("has-alerts");
        } else {
          alertsBadgeCount.style.display = "none";
          alertsToggleBtn.classList.remove("has-alerts");
        }
      }

      if (unreadAlertsCount > lastAlertsCount && cachedAlerts.length > 0) {
        const topAlert = cachedAlerts[0];
        showToast(`🚨 Easter Egg Trigger: "${topAlert.trigger}" by ${topAlert.userName || "User"}!`, "error");
      }
      lastAlertsCount = unreadAlertsCount;
    }
  } catch (err) {
    console.warn("Failed to fetch alerts:", err);
  }
}

function renderAlertsModal() {
  if (!alertsListBody) return;

  if (cachedAlerts.length === 0) {
    alertsListBody.innerHTML = `
      <div class="empty-state-canvas" style="padding: 20px 0;">
        <i data-lucide="shield-check" class="empty-icon"></i>
        <h3>NO ALERTS</h3>
        <p>No secret commands or easter egg triggers detected yet.</p>
      </div>
    `;
    refreshIcons();
    return;
  }

  alertsListBody.innerHTML = cachedAlerts
    .map((alert) => {
      const timeStr = alert.createdAt
        ? new Date(alert.createdAt).toLocaleString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            day: "numeric",
            month: "short",
          })
        : "";

      const typeLabel = alert.type === "NSFW_TRIGGER" ? "NSFW / SPOILER" : alert.type || "EASTER_EGG";

      const hasMemeRequest = alert.memeRequestId && alert.memeUrl;
      const isPendingMeme = hasMemeRequest && alert.memeStatus === "PENDING";
      const isApprovedMeme = hasMemeRequest && alert.memeStatus === "APPROVED";
      const isRejectedMeme = hasMemeRequest && alert.memeStatus === "REJECTED";

      let memeActionDeck = "";
      if (hasMemeRequest) {
        if (isPendingMeme) {
          memeActionDeck = `
            <div class="alert-meme-preview-wrap">
              <div class="alert-meme-thumb">
                <img src="${escapeHtml(alert.memeUrl)}" alt="Meme Preview" onerror="this.style.display='none'">
              </div>
              <div class="alert-meme-actions">
                <button class="meme-action-btn approve" data-req-id="${alert.memeRequestId}">
                  <i data-lucide="check"></i> Approve & Send
                </button>
                <button class="meme-action-btn reject" data-req-id="${alert.memeRequestId}">
                  <i data-lucide="x"></i> Reject
                </button>
              </div>
            </div>
          `;
        } else if (isApprovedMeme) {
          memeActionDeck = `
            <div class="alert-status-badge approved">
              <i data-lucide="check-circle-2"></i> APPROVED & DELIVERED (WITH SPOILER)
            </div>
          `;
        } else if (isRejectedMeme) {
          memeActionDeck = `
            <div class="alert-status-badge rejected">
              <i data-lucide="x-circle"></i> REJECTED BY ADMIN
            </div>
          `;
        }
      } else if (
        alert.type === "NSFW_TRIGGER" ||
        (alert.trigger && alert.trigger.toLowerCase().includes("meme")) ||
        (alert.message && alert.message.toLowerCase().includes("show_meme"))
      ) {
        memeActionDeck = `
          <div class="alert-meme-preview-wrap" style="justify-content: flex-end;">
            <button class="meme-action-btn approve send-direct-meme-btn" data-chat-id="${alert.chatId}">
              <i data-lucide="flame"></i> Send Random NSFW Meme (Spoiler)
            </button>
          </div>
        `;
      }

      return `
        <div class="alert-item-card ${alert.isRead ? "" : "unread"}" data-chat-id="${alert.chatId}">
          <div class="alert-item-header">
            <span class="alert-type-tag">${escapeHtml(typeLabel)}</span>
            <span class="alert-time">${escapeHtml(timeStr)}</span>
          </div>
          <div class="alert-user-row">
            <span>${escapeHtml(alert.userName || "User")}</span>
            <span class="alert-user-handle">${alert.username ? `@${escapeHtml(alert.username)}` : `ID: ${alert.chatId}`}</span>
          </div>
          <div class="alert-message-box">
            🎯 <strong>${escapeHtml(alert.trigger)}</strong>: "${escapeHtml(alert.message)}"
          </div>
          ${memeActionDeck}
        </div>
      `;
    })
    .join("");

  alertsListBody.querySelectorAll(".meme-action-btn.approve:not(.send-direct-meme-btn)").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const reqId = btn.dataset.reqId;
      btn.disabled = true;
      btn.innerHTML = `<span class="upload-spinner" style="width:10px;height:10px;"></span> Sending...`;
      await executeMemeAction(reqId, "approve");
    });
  });

  alertsListBody.querySelectorAll(".meme-action-btn.reject").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const reqId = btn.dataset.reqId;
      btn.disabled = true;
      btn.innerHTML = `<span class="upload-spinner" style="width:10px;height:10px;"></span> Rejecting...`;
      await executeMemeAction(reqId, "reject");
    });
  });

  alertsListBody.querySelectorAll(".send-direct-meme-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const targetChatId = btn.dataset.chatId;
      btn.disabled = true;
      btn.innerHTML = `<span class="upload-spinner" style="width:10px;height:10px;"></span> Transmitting...`;
      await quickCastMeme(targetChatId);
      btn.innerHTML = `<i data-lucide="check"></i> Sent!`;
      refreshIcons();
    });
  });

  alertsListBody.querySelectorAll(".alert-item-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".meme-action-btn")) return;
      const targetChatId = Number(card.dataset.chatId);
      const user = allUsers.find((u) => u.telegramId === targetChatId);
      if (user) {
        selectUserThread(user);
        closeAlertsModal();
      } else {
        showToast("User conversation loaded in directory.", "success");
      }
    });
  });

  refreshIcons();
}

async function quickCastMeme(targetChatId) {
  if (!targetChatId) {
    showToast("Please select a user conversation first.", "error");
    return;
  }

  try {
    showToast("🌶️ Fetching and transmitting random NSFW meme...", "success");

    const res = await fetch(getApiUrl("/admin/send-random-meme"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetChatId }),
    });

    const data = await res.json();
    if (data.ok) {
      showToast(`✅ Delivered: "${data.result?.meme?.title || "Meme"}" with spoiler blur!`, "success");
      if (activeTargetUser && String(activeTargetUser.telegramId) === String(targetChatId)) {
        await loadConversationMessages(true);
      }
    } else {
      showToast(`❌ Error: ${data.error || "Could not send meme"}`, "error");
    }
  } catch (err) {
    showToast(`❌ Failed to send meme: ${err.message}`, "error");
  }
}

async function executeMemeAction(requestId, action) {
  try {
    const res = await fetch(getApiUrl("/admin/meme-action"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, action }),
    });
    const data = await res.json();
    if (data.ok) {
      showToast(
        action === "approve"
          ? "✅ Meme approved & delivered to user with spoiler blur!"
          : "❌ Meme request rejected.",
        "success"
      );
      await fetchAlerts();
    } else {
      showToast(`Error: ${data.error || "Failed to process"}`, "error");
    }
  } catch (err) {
    showToast(`Action failed: ${err.message}`, "error");
  }
}

function openAlertsModal() {
  renderAlertsModal();
  alertsModalOverlay.style.display = "flex";
}

function closeAlertsModal() {
  alertsModalOverlay.style.display = "none";
}

async function markAllAlertsAsRead() {
  try {
    await fetch(getApiUrl("/admin/alerts/mark-read"), { method: "POST" });
    unreadAlertsCount = 0;
    lastAlertsCount = 0;
    cachedAlerts.forEach((a) => (a.isRead = true));
    if (alertsBadgeCount) alertsBadgeCount.style.display = "none";
    renderAlertsModal();
    showToast("✅ All alerts marked as read.", "success");
  } catch (err) {
    showToast("❌ Failed to mark alerts as read.", "error");
  }
}

if (alertsToggleBtn) {
  alertsToggleBtn.addEventListener("click", openAlertsModal);
}
if (closeAlertsModalBtn) {
  closeAlertsModalBtn.addEventListener("click", closeAlertsModal);
}
if (markAlertsReadBtn) {
  markAlertsReadBtn.addEventListener("click", markAllAlertsAsRead);
}
if (alertsModalOverlay) {
  alertsModalOverlay.addEventListener("click", (e) => {
    if (e.target === alertsModalOverlay) closeAlertsModal();
  });
}

const quickCastMemeBtn = document.getElementById("quickCastMemeBtn");
if (quickCastMemeBtn) {
  quickCastMemeBtn.addEventListener("click", async () => {
    if (!activeTargetUser) {
      showToast("Please select a user conversation from the directory first.", "error");
      return;
    }
    quickCastMemeBtn.disabled = true;
    await quickCastMeme(activeTargetUser.telegramId);
    quickCastMemeBtn.disabled = false;
  });
}

// ------------------------------------------------------------------
// 7. EVENT LISTENERS & INITIALIZATION
// ------------------------------------------------------------------

sendBtn.addEventListener("click", sendMessage);

chatMessageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

chatMessageInput.addEventListener("input", () => {
  chatMessageInput.style.height = "auto";
  chatMessageInput.style.height = `${Math.min(chatMessageInput.scrollHeight, 120)}px`;
});

userSearchInput.addEventListener("input", renderUsersList);
refreshUsersBtn.addEventListener("click", fetchUsers);
manualRefreshBtn.addEventListener("click", () => loadConversationMessages(true));

autoPollToggleBtn.addEventListener("click", () => {
  isAutoPollActive = !isAutoPollActive;
  autoPollToggleBtn.classList.toggle("active", isAutoPollActive);
  autoPollToggleBtn.querySelector("span").textContent = isAutoPollActive ? "AUTO-SYNC: ON" : "AUTO-SYNC: OFF";
});

// Real-Time Polling Loop
function startPolling() {
  setInterval(async () => {
    if (isAutoPollActive && document.visibilityState === "visible") {
      if (activeTargetUser) {
        await loadConversationMessages();
      }
      await fetchUsers();
      await fetchAlerts();
    }
  }, 2500);
}

// Live Clock
function updateClock() {
  if (liveClock) {
    const now = new Date();
    liveClock.textContent = `${now.toLocaleTimeString("en-US", { hour12: false })} IST`;
  }
}
setInterval(updateClock, 1000);
updateClock();

// Initial Boot
document.addEventListener("DOMContentLoaded", async () => {
  refreshIcons();
  await fetchUsers();
  await fetchAlerts();

  if (allUsers.length > 0) {
    selectUserThread(allUsers[0]);
  }

  startPolling();
});
