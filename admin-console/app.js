// AtharvaOS // Monochrome Bot POV Console Controller (Zero-Flicker Live Engine & Direct Media Uploader)

const API_BASE_URL = "https://ged2lb24hngndlzk5b73dmvdqy0ydsmo.lambda-url.ap-south-1.on.aws/api";
const OWNER_CHAT_ID = "5275149287";

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
const alertsToggleBtn = document.getElementById("alertsToggleBtn");
const alertsBadgeCount = document.getElementById("alertsBadgeCount");
const alertsModalOverlay = document.getElementById("alertsModalOverlay");
const closeAlertsModalBtn = document.getElementById("closeAlertsModalBtn");
const markAlertsReadBtn = document.getElementById("markAlertsReadBtn");
const alertsListBody = document.getElementById("alertsListBody");

const messagesStreamEl = document.getElementById("messagesStreamEl");
const mediaStagingBar = document.getElementById("mediaStagingBar");
const previewMediaWrapper = document.getElementById("previewMediaWrapper");
const mediaPreviewImg = document.getElementById("mediaPreviewImg");
const mediaPreviewVid = document.getElementById("mediaPreviewVid");
const spoilerBadgeOverlay = document.getElementById("spoilerBadgeOverlay");
const mediaFileName = document.getElementById("mediaFileName");
const mediaReadyTag = document.getElementById("mediaReadyTag");
const toggleSpoilerBtn = document.getElementById("toggleSpoilerBtn");
const spoilerBtnText = document.getElementById("spoilerBtnText");
const clearMediaBtn = document.getElementById("clearMediaBtn");

const uploadProgressWrapper = document.getElementById("uploadProgressWrapper");
const progressBarFill = document.getElementById("progressBarFill");
const uploadStatusText = document.getElementById("uploadStatusText");
const uploadPercentText = document.getElementById("uploadPercentText");
const toastNotification = document.getElementById("toastNotification");
const toastMsg = document.getElementById("toastMsg");

const mediaFileInput = document.getElementById("mediaFileInput");
const attachMediaBtn = document.getElementById("attachMediaBtn");
const chatMessageInput = document.getElementById("chatMessageInput");
const sendBtn = document.getElementById("sendBtn");

// Helper: Refresh Lucide Icons
function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

// Toast Notifications
function showToast(message, type = "success") {
  if (!toastNotification || !toastMsg) return;
  toastMsg.textContent = message;
  toastNotification.className = `toast-notification ${type}`;
  toastNotification.style.display = "flex";
  setTimeout(() => {
    toastNotification.style.display = "none";
  }, 4000);
}

// Upload Progress Helper
function updateUploadProgress(percent, label) {
  if (!uploadProgressWrapper) return;
  uploadProgressWrapper.style.display = "flex";
  progressBarFill.style.width = `${percent}%`;
  uploadPercentText.textContent = `${percent}%`;
  if (label) uploadStatusText.textContent = label;
}

function hideUploadProgress() {
  if (uploadProgressWrapper) {
    uploadProgressWrapper.style.display = "none";
    progressBarFill.style.width = "0%";
  }
}

// Live Clock Ticker
function startLiveClock() {
  function update() {
    const now = new Date();
    liveClock.textContent = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  }
  update();
  setInterval(update, 1000);
}

// Escape HTML
function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = String(str);
  return div.innerHTML;
}

// Relative Time Formatter
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
    const res = await fetch(`${API_BASE_URL}/stats?chatId=${OWNER_CHAT_ID}`);
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

// 2. Render Users Directory (Handles Users With and Without Username)
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
      const initial = displayName.replace(/^@/, "").charAt(0).toUpperCase() || "U";
      const isActive = activeTargetUser && String(activeTargetUser.telegramId) === String(u.telegramId);
      const handleTag = u.username ? `@${escapeHtml(u.username)}` : `ID:${u.telegramId}`;
      const timeStr = formatRelativeTime(u.lastActive);

      return `
        <div class="user-item ${isActive ? "active" : ""}" data-chat-id="${u.telegramId}">
          <div class="user-avatar-mini">${escapeHtml(initial)}</div>
          <div class="user-info-col">
            <div class="user-top-line">
              <span class="user-name-text">${escapeHtml(displayName)}</span>
              <span class="msg-count-tag">${timeStr || `${u.messageCount || 0} msgs`}</span>
            </div>
            <div class="user-snippet-text">
              <span style="color:var(--border-highlight); font-family:var(--font-mono); font-size:0.7rem; margin-right:4px;">${handleTag}</span>
              ${escapeHtml(u.lastMessageSnippet || "No activity")}
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  usersListEl.querySelectorAll(".user-item").forEach((el) => {
    el.addEventListener("click", () => {
      const chatId = el.dataset.chatId;
      const targetUser = allUsers.find((u) => String(u.telegramId) === String(chatId));
      if (targetUser) {
        selectUserThread(targetUser);
      }
    });
  });
}

// 3. Select a User Thread
async function selectUserThread(user) {
  activeTargetUser = user;
  activeMessages = [];
  renderUsersList();

  const displayName = user.firstName || (user.username ? `@${user.username}` : `User #${user.telegramId}`);
  activeUserName.textContent = displayName;
  activeAvatar.textContent = displayName.replace(/^@/, "").charAt(0).toUpperCase() || "U";
  activeUserHandle.textContent = user.username ? `@${user.username}` : "NO USERNAME";
  activeUserMeta.textContent = `TG_ID: ${user.telegramId}`;

  messagesStreamEl.innerHTML = `
    <div class="skeleton-row" style="width:50%;"></div>
    <div class="skeleton-row" style="width:65%; align-self:flex-end;"></div>
  `;

  await loadConversationMessages(true);
  chatMessageInput.focus();
}

// Markdown to Rich HTML Formatter for Chat Bubbles
function formatMarkdownToHtml(text) {
  if (!text) return "";
  let html = escapeHtml(String(text));

  // Code blocks ```code```
  html = html.replace(/```([\s\S]*?)```/g, '<pre style="background:rgba(0,0,0,0.4); padding:8px 12px; border-radius:6px; font-family:var(--font-mono); font-size:0.82rem; margin:6px 0; overflow-x:auto;">$1</pre>');

  // Inline code `code`
  html = html.replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.3); padding:2px 6px; border-radius:4px; font-family:var(--font-mono); font-size:0.82rem; color:var(--accent-cyan);">$1</code>');

  // Double bold **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong style="color:var(--text-pure-white); font-weight:700;">$1</strong>');

  // Single asterisk *text*
  html = html.replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1<strong style="color:var(--text-pure-white); font-weight:700;">$2</strong>$3');

  // Italic _text_
  html = html.replace(/(^|[^_])_([^_]+)_([^_]|$)/g, '$1<em>$2</em>$3');

  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:var(--accent-cyan); text-decoration:underline;">$1</a>');

  // Line breaks \n to <br>
  html = html.replace(/\n/g, "<br>");

  return html;
}

// Create a single message DOM element with Spoiler Badge, Edit & Delete Actions
function createMessageElement(msg) {
  const isBot = msg.role === "assistant";
  const senderLabel = isBot ? "ATHARVAOS // PROXY" : (activeTargetUser?.firstName || "USER").toUpperCase();
  const timeStr = msg.createdAt
    ? new Date(msg.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
    : "";

  const hasSpoilerBadge =
    msg.hasSpoiler ||
    (typeof msg.content === "string" && msg.content.includes("🙈")) ||
    (typeof msg.content === "string" && msg.content.toLowerCase().includes("spoiler"));

  const div = document.createElement("div");
  div.className = `msg-row ${isBot ? "bot-msg" : "user-msg"}`;
  div.dataset.msgKey = msg._id || `${msg.role}-${msg.content}-${msg.createdAt}`;
  div.innerHTML = `
    <div class="msg-sender-tag">
      <span>${escapeHtml(senderLabel)}</span>
      ${hasSpoilerBadge ? `<span class="spoiler-bubble-badge"><i data-lucide="eye-off"></i> SPOILER</span>` : ""}
    </div>
    <div class="msg-content-wrapper">
      <div class="msg-card" id="msgCardText_${msg._id || Math.random().toString(36).substring(2, 7)}">
        ${formatMarkdownToHtml(msg.content)}
      </div>
      <div class="msg-actions-bar">
        <button class="msg-action-btn edit-btn" title="Edit message text">
          <i data-lucide="pencil"></i>
        </button>
        <button class="msg-action-btn delete-btn" title="Delete message from conversation & Telegram">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    </div>
    <div class="msg-time">${escapeHtml(timeStr)}</div>
  `;

  // Attach Edit event
  const editBtn = div.querySelector(".edit-btn");
  if (editBtn) {
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      startInlineEdit(msg, div);
    });
  }

  // Attach Delete event
  const deleteBtn = div.querySelector(".delete-btn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await deleteAdminMessage(msg, div);
    });
  }

  return div;
}

// Inline Message Editor
function startInlineEdit(msg, rowEl) {
  const contentWrapper = rowEl.querySelector(".msg-content-wrapper");
  const originalText = msg.content || "";

  contentWrapper.innerHTML = `
    <div class="inline-edit-box">
      <textarea class="inline-edit-textarea" rows="2">${escapeHtml(originalText)}</textarea>
      <div class="inline-edit-buttons">
        <button class="inline-btn cancel">Cancel</button>
        <button class="inline-btn save">Save Changes</button>
      </div>
    </div>
  `;

  const textarea = contentWrapper.querySelector(".inline-edit-textarea");
  const cancelBtn = contentWrapper.querySelector(".inline-btn.cancel");
  const saveBtn = contentWrapper.querySelector(".inline-btn.save");

  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);

  cancelBtn.addEventListener("click", () => {
    // Restore message element
    const newElem = createMessageElement(msg);
    rowEl.replaceWith(newElem);
    refreshIcons();
  });

  saveBtn.addEventListener("click", async () => {
    const updatedText = textarea.value.trim();
    if (!updatedText) return;

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
      const endpoint = window.location.origin.includes("localhost")
        ? "/api/local-edit-message"
        : `${API_BASE_URL}/admin/edit-message`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId: OWNER_CHAT_ID,
          messageId: msg._id,
          chatId: activeTargetUser ? activeTargetUser.telegramId : null,
          telegramMessageId: msg.telegramMessageId,
          newText: updatedText,
        }),
      });

      const data = await res.json();
      if (data.ok || data.success) {
        msg.content = updatedText;
        const newElem = createMessageElement(msg);
        rowEl.replaceWith(newElem);
        refreshIcons();
        showToast("✏️ Message updated in transcript & Telegram!", "success");
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
    const endpoint = window.location.origin.includes("localhost")
      ? "/api/local-delete-message"
      : `${API_BASE_URL}/admin/delete-message`;

    const res = await fetch(endpoint, {
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

// 4. Load Conversation Messages (Robust Key-Based Zero-Flicker Diffing)
async function loadConversationMessages(isInitialSelect = false) {
  if (!activeTargetUser) return;

  try {
    const res = await fetch(
      `${API_BASE_URL}/admin/conversations?chatId=${OWNER_CHAT_ID}&targetChatId=${activeTargetUser.telegramId}`
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

      const currentDomKeys = Array.from(messagesStreamEl.querySelectorAll(".msg-row"))
        .map((el) => el.dataset.msgKey)
        .filter(Boolean);
      const incomingKeys = incomingMessages.map(
        (msg) => msg._id || `${msg.role}-${msg.content}-${msg.createdAt}`
      );

      if (
        !isInitialSelect &&
        currentDomKeys.length === incomingKeys.length &&
        currentDomKeys.join(",") === incomingKeys.join(",")
      ) {
        return;
      }

      const isNearBottom =
        messagesStreamEl.scrollHeight - messagesStreamEl.scrollTop <= messagesStreamEl.clientHeight + 80;

      activeMessages = incomingMessages;
      messagesStreamEl.innerHTML = "";

      if (activeMessages.length === 0) {
        messagesStreamEl.innerHTML = `
          <div class="empty-state-canvas">
            <i data-lucide="message-square" class="empty-icon"></i>
            <h3>EMPTY TRANSCRIPT</h3>
            <p>No messages recorded for ${escapeHtml(activeTargetUser.firstName)}. Start the conversation below!</p>
          </div>
        `;
        refreshIcons();
        return;
      }

      activeMessages.forEach((msg) => {
        messagesStreamEl.appendChild(createMessageElement(msg));
      });

      if (isInitialSelect || isNearBottom) {
        messagesStreamEl.scrollTop = messagesStreamEl.scrollHeight;
      }
    }
  } catch (err) {
    console.error("Failed to load conversation transcript:", err);
  }
}

// 5. Send Message as Bot (Human Proxy with Real-Time Video & Photo Progress)
async function sendMessage() {
  if (!activeTargetUser) {
    showToast("Please select a user thread first!", "error");
    return;
  }

  const text = chatMessageInput.value.trim();
  const media = stagedMediaBase64;
  const mType = stagedMediaType;
  const fName = stagedMediaFileName;
  const spoilerFlag = Boolean(isSpoilerActive);

  if (!text && !media) return;

  // Clear Input & Staged Media immediately
  chatMessageInput.value = "";
  chatMessageInput.style.height = "auto";
  clearStagedMedia();

  // Optimistic UI Append
  const isVideo = mType.startsWith("video/") || /\.(mp4|mov|webm|mkv|avi)$/i.test(fName);
  const mediaPrefix = isVideo ? "[Video]" : "[Photo]";
  const optimisticContent = media ? `${mediaPrefix} ${text}`.trim() : text;
  const tempMsg = {
    role: "assistant",
    content: optimisticContent,
    hasSpoiler: spoilerFlag,
    createdAt: new Date().toISOString(),
  };

  const emptyStateEl = messagesStreamEl.querySelector(".empty-state-canvas");
  if (emptyStateEl) emptyStateEl.remove();

  const msgElement = createMessageElement(tempMsg);
  messagesStreamEl.appendChild(msgElement);
  activeMessages.push(tempMsg);
  messagesStreamEl.scrollTop = messagesStreamEl.scrollHeight;

  // -------------------------------------------------------------
  // If Media is attached: Use direct XHR with Upload Progress Bar!
  // -------------------------------------------------------------
  if (media) {
    sendBtn.disabled = true;
    updateUploadProgress(10, `UPLOADING ${isVideo ? "VIDEO" : "PHOTO"}...`);

    const xhr = new XMLHttpRequest();
    // Use local server upload endpoint when running locally, fallback to AWS API URL
    const uploadUrl = window.location.origin.includes("localhost")
      ? "/api/local-upload"
      : `${API_BASE_URL}/admin/send-message`;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.min(95, Math.round((event.loaded / event.total) * 90) + 5);
        const loadedMb = (event.loaded / (1024 * 1024)).toFixed(1);
        const totalMb = (event.total / (1024 * 1024)).toFixed(1);
        updateUploadProgress(percent, `TRANSMITTING ${isVideo ? "VIDEO" : "PHOTO"} (${loadedMb}MB / ${totalMb}MB)...`);
      }
    };

    xhr.onload = () => {
      sendBtn.disabled = false;
      updateUploadProgress(100, "TELEGRAM PROCESSING...");
      setTimeout(hideUploadProgress, 1000);

      try {
        const data = JSON.parse(xhr.responseText);
        if (data.ok || data.success) {
          showToast(`✅ ${isVideo ? "Video" : "Photo"} delivered to Telegram!`, "success");

          // Update tempMsg with real IDs for immediate editing/deletion
          const hDoc = data.history || data.historyDoc;
          if (hDoc && hDoc._id) tempMsg._id = hDoc._id;
          const tgMsgId = hDoc?.telegramMessageId || data.telegramResult?.message_id || data.telegramMessageId;
          if (tgMsgId) tempMsg.telegramMessageId = tgMsgId;

          msgElement.dataset.msgKey = tempMsg._id || `${tempMsg.role}-${tempMsg.content}-${tempMsg.createdAt}`;
        } else {
          showToast(`⚠️ ${data.error || "Telegram upload failed"}`, "error");
        }
      } catch (e) {
        showToast("⚠️ Delivery response error.", "error");
      }
    };

    xhr.onerror = () => {
      sendBtn.disabled = false;
      hideUploadProgress();
      showToast("❌ Network error while uploading media.", "error");
    };

    xhr.open("POST", uploadUrl, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(
      JSON.stringify({
        ownerId: OWNER_CHAT_ID,
        targetChatId: activeTargetUser.telegramId,
        text,
        mediaBase64: media,
        mediaType: mType,
        fileName: fName,
        caption: text,
        hasSpoiler: spoilerFlag,
      })
    );
  } else {
    // Pure Text Message
    try {
      const res = await fetch(`${API_BASE_URL}/admin/send-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId: OWNER_CHAT_ID,
          targetChatId: activeTargetUser.telegramId,
          text,
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (data.history?._id) tempMsg._id = data.history._id;
        if (data.telegramMessageId) tempMsg.telegramMessageId = data.telegramMessageId;
        msgElement.dataset.msgKey = tempMsg._id || `${tempMsg.role}-${tempMsg.content}-${tempMsg.createdAt}`;
      } else {
        showToast(`⚠️ ${data.error || "Failed to send text"}`, "error");
      }
    } catch (err) {
      showToast("❌ Failed to transmit text via bot.", "error");
    }
  }
}

const dragDropOverlay = document.getElementById("dragDropOverlay");
const chatViewContainer = document.querySelector(".chat-view-container");

// Spoiler / Censor Toggle Helper (Telegram Native 'Hide with spoiler')
function updateSpoilerUI() {
  if (toggleSpoilerBtn) {
    toggleSpoilerBtn.classList.toggle("active", isSpoilerActive);
    if (spoilerBtnText) {
      spoilerBtnText.textContent = isSpoilerActive ? "Hidden with spoiler (ON)" : "Hide with spoiler";
    }
  }
  if (previewMediaWrapper) {
    previewMediaWrapper.classList.toggle("has-spoiler", isSpoilerActive);
  }
  if (spoilerBadgeOverlay) {
    spoilerBadgeOverlay.style.display = isSpoilerActive ? "flex" : "none";
  }
  if (mediaReadyTag) {
    mediaReadyTag.classList.toggle("spoiler-active", isSpoilerActive);
    const isVideo = stagedMediaType.startsWith("video/") || /\.(mp4|mov|webm|mkv|avi)$/i.test(stagedMediaFileName);
    const baseTag = isVideo ? "VIDEO" : "PHOTO";
    mediaReadyTag.textContent = isSpoilerActive ? `SPOILER ${baseTag} READY` : `${baseTag} READY TO TRANSMIT`;
  }
  refreshIcons();
}

if (toggleSpoilerBtn) {
  toggleSpoilerBtn.addEventListener("click", () => {
    isSpoilerActive = !isSpoilerActive;
    updateSpoilerUI();
    showToast(isSpoilerActive ? "🙈 Telegram 'Hide with spoiler' enabled" : "👁️ Telegram 'Hide with spoiler' disabled", "success");
  });
}

// 6. Media Handling & Base64 Converter (Images & Videos)
function handleMediaFile(file) {
  if (!file) return;

  const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|webm|mkv|avi)$/i.test(file.name);
  const isPhoto = file.type.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp)$/i.test(file.name);

  if (!isVideo && !isPhoto) {
    showToast("⚠️ Only photos and videos are supported.", "error");
    return;
  }

  stagedMediaFileName = file.name || (isVideo ? "video.mp4" : "photo.jpg");
  stagedMediaType = file.type || (isVideo ? "video/mp4" : "image/jpeg");

  const reader = new FileReader();
  reader.onload = () => {
    stagedMediaBase64 = reader.result;
    mediaFileName.textContent = stagedMediaFileName;

    if (isVideo) {
      mediaPreviewImg.style.display = "none";
      mediaPreviewVid.style.display = "block";
      mediaPreviewVid.src = stagedMediaBase64;
      if (mediaReadyTag) mediaReadyTag.textContent = "VIDEO READY TO TRANSMIT";
    } else {
      mediaPreviewVid.style.display = "none";
      mediaPreviewImg.style.display = "block";
      mediaPreviewImg.src = stagedMediaBase64;
      if (mediaReadyTag) mediaReadyTag.textContent = "PHOTO READY TO TRANSMIT";
    }

    mediaStagingBar.style.display = "block";
    chatMessageInput.focus();
    showToast(`📎 Staged: ${stagedMediaFileName}`, "success");
  };
  reader.readAsDataURL(file);
}

attachMediaBtn.addEventListener("click", () => {
  mediaFileInput.click();
});

mediaFileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) handleMediaFile(file);
});

function clearStagedMedia() {
  stagedMediaBase64 = null;
  stagedMediaFileName = "";
  stagedMediaType = "";
  isSpoilerActive = false;
  updateSpoilerUI();
  mediaFileInput.value = "";
  mediaPreviewImg.src = "";
  mediaPreviewImg.style.display = "none";
  mediaPreviewVid.src = "";
  mediaPreviewVid.style.display = "none";
  mediaStagingBar.style.display = "none";
}

clearMediaBtn.addEventListener("click", clearStagedMedia);

// 7. Drag and Drop Support
let dragCounter = 0;

window.addEventListener("dragenter", (e) => {
  e.preventDefault();
  if (e.dataTransfer && e.dataTransfer.types.includes("Files")) {
    dragCounter++;
    if (dragDropOverlay) dragDropOverlay.style.display = "flex";
  }
});

window.addEventListener("dragover", (e) => {
  e.preventDefault();
});

window.addEventListener("dragleave", (e) => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    if (dragDropOverlay) dragDropOverlay.style.display = "none";
  }
});

window.addEventListener("drop", (e) => {
  e.preventDefault();
  dragCounter = 0;
  if (dragDropOverlay) dragDropOverlay.style.display = "none";

  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0];
    handleMediaFile(file);
  }
});

// 8. Clipboard Paste Support (Ctrl+V directly pastes images/videos)
window.addEventListener("paste", (e) => {
  if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
    const file = e.clipboardData.files[0];
    handleMediaFile(file);
  }
});

// 9. Easter Egg & Security Alerts System
let cachedAlerts = [];

async function fetchAlerts() {
  try {
    const alertsUrl = window.location.origin.includes("localhost")
      ? "/api/admin/alerts"
      : `${API_BASE_URL}/admin/alerts`;

    const res = await fetch(alertsUrl);
    const data = await res.json();

    if (data.ok || data.alerts) {
      cachedAlerts = data.alerts || [];
      unreadAlertsCount = data.unreadCount || 0;

      // Update Header Bell Badge
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

      // Check if new alert just triggered
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
        // Direct Send Meme Button for any /show_meme or NSFW alert
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

  // Attach Approve / Reject Button handlers
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

  // Attach Direct Send Meme from Alert
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

  // Attach click to jump into user thread
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

    const castUrl = window.location.origin.includes("localhost")
      ? "/api/admin/send-random-meme"
      : `${API_BASE_URL}/admin/send-random-meme`;

    const res = await fetch(castUrl, {
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
    const actionUrl = window.location.origin.includes("localhost")
      ? "/api/admin/meme-action"
      : `${API_BASE_URL}/admin/meme-action`;

    const res = await fetch(actionUrl, {
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
    const markUrl = window.location.origin.includes("localhost")
      ? "/api/admin/alerts/mark-read"
      : `${API_BASE_URL}/admin/alerts/mark-read`;

    await fetch(markUrl, { method: "POST" });
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

// 7. Event Listeners & Shortcuts
sendBtn.addEventListener("click", sendMessage);

chatMessageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Auto-expand textarea
chatMessageInput.addEventListener("input", () => {
  chatMessageInput.style.height = "auto";
  chatMessageInput.style.height = `${Math.min(chatMessageInput.scrollHeight, 120)}px`;
});

userSearchInput.addEventListener("input", renderUsersList);
refreshUsersBtn.addEventListener("click", fetchUsers);
manualRefreshBtn.addEventListener("click", () => loadConversationMessages(true));

// Toggle Auto-Polling
autoPollToggleBtn.addEventListener("click", () => {
  isAutoPollActive = !isAutoPollActive;
  autoPollToggleBtn.classList.toggle("active", isAutoPollActive);
  autoPollToggleBtn.querySelector("span").textContent = isAutoPollActive ? "AUTO-SYNC: ON" : "AUTO-SYNC: OFF";
});

// Real-Time Polling Loop (Smart visibility-aware sync to conserve MongoDB connection limits)
function startPolling() {
  setInterval(async () => {
    // Only poll when the tab is actively visible to the user
    if (isAutoPollActive && document.visibilityState === "visible") {
      if (activeTargetUser) {
        await loadConversationMessages();
      }
      await fetchUsers();
      await fetchAlerts();
    }
  }, 4000);

  // Instantly fetch latest updates when user switches back to this tab
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "visible" && isAutoPollActive) {
      if (activeTargetUser) {
        await loadConversationMessages();
      }
      await fetchUsers();
      await fetchAlerts();
    }
  });
}

// Initialization
document.addEventListener("DOMContentLoaded", () => {
  startLiveClock();
  fetchUsers();
  fetchAlerts();
  startPolling();
  refreshIcons();
});
