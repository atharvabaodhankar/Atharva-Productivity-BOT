// AtharvaOS // Monochrome Bot POV Console Controller (Real-Time Live Engine)

const API_BASE_URL = "https://ged2lb24hngndlzk5b73dmvdqy0ydsmo.lambda-url.ap-south-1.on.aws/api";
const OWNER_CHAT_ID = "5275149287";

// State
let allUsers = [];
let activeTargetUser = null;
let activeMessages = [];
let stagedMediaBase64 = null;
let stagedMediaFileName = "";
let isAutoPollActive = true;
let lastKnownMsgCount = 0;

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
const mediaStagingBar = document.getElementById("mediaStagingBar");
const mediaPreviewImg = document.getElementById("mediaPreviewImg");
const mediaFileName = document.getElementById("mediaFileName");
const clearMediaBtn = document.getElementById("clearMediaBtn");

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

// 1. Fetch Users List (Sorted by Most Recent Activity)
async function fetchUsers() {
  try {
    const res = await fetch(`${API_BASE_URL}/stats?chatId=${OWNER_CHAT_ID}`);
    const data = await res.json();

    if (data && data.users) {
      allUsers = data.users;
      renderUsersList();
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

  // Attach click events
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
  lastKnownMsgCount = 0;
  renderUsersList(); // Update active highlights

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

// 4. Load Conversation Messages (With Auto-Scroll and Live Polling)
async function loadConversationMessages(isInitialSelect = false) {
  if (!activeTargetUser) return;

  try {
    const res = await fetch(
      `${API_BASE_URL}/admin/conversations?chatId=${OWNER_CHAT_ID}&targetChatId=${activeTargetUser.telegramId}`
    );
    const data = await res.json();

    if (data && data.messages) {
      const isNewMessageArrived = data.messages.length > lastKnownMsgCount;
      activeMessages = data.messages;
      lastKnownMsgCount = data.messages.length;

      // Check if user was near bottom before re-rendering
      const isNearBottom =
        messagesStreamEl.scrollHeight - messagesStreamEl.scrollTop <= messagesStreamEl.clientHeight + 100;

      renderMessagesStream();

      if (isInitialSelect || isNewMessageArrived || isNearBottom) {
        messagesStreamEl.scrollTop = messagesStreamEl.scrollHeight;
      }
    }
  } catch (err) {
    console.error("Failed to load conversation transcript:", err);
  }
}

// 5. Render Messages Stream
function renderMessagesStream() {
  if (!activeTargetUser) return;

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

  messagesStreamEl.innerHTML = activeMessages
    .map((msg) => {
      const isBot = msg.role === "assistant";
      const senderLabel = isBot ? "ATHARVAOS // PROXY" : (activeTargetUser.firstName || "USER").toUpperCase();
      const timeStr = msg.createdAt
        ? new Date(msg.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
        : "";

      return `
        <div class="msg-row ${isBot ? "bot-msg" : "user-msg"}">
          <div class="msg-sender-tag">
            <span>${escapeHtml(senderLabel)}</span>
          </div>
          <div class="msg-card">
            ${escapeHtml(msg.content)}
          </div>
          <div class="msg-time">${escapeHtml(timeStr)}</div>
        </div>
      `;
    })
    .join("");

  refreshIcons();
}

// 6. Send Message as Bot (Human Proxy)
async function sendMessage() {
  if (!activeTargetUser) {
    alert("Please select a user thread first!");
    return;
  }

  const text = chatMessageInput.value.trim();
  const media = stagedMediaBase64;

  if (!text && !media) return;

  // Optimistic UI Append
  const optimisticContent = media ? `[Photo] ${text}`.trim() : text;
  const tempMsg = {
    role: "assistant",
    content: optimisticContent,
    createdAt: new Date().toISOString(),
  };

  activeMessages.push(tempMsg);
  lastKnownMsgCount++;
  renderMessagesStream();
  messagesStreamEl.scrollTop = messagesStreamEl.scrollHeight;

  // Clear Input & Staged Media
  chatMessageInput.value = "";
  chatMessageInput.style.height = "auto";
  clearStagedMedia();

  try {
    const res = await fetch(`${API_BASE_URL}/admin/send-message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ownerId: OWNER_CHAT_ID,
        targetChatId: activeTargetUser.telegramId,
        text,
        mediaBase64: media,
        caption: text,
      }),
    });

    const data = await res.json();
    if (!data.success) {
      console.error("Delivery error:", data.error);
    }
  } catch (err) {
    console.error("Failed to transmit message via bot:", err);
  }
}

// 7. Media Handling & Base64 Converter
attachMediaBtn.addEventListener("click", () => {
  mediaFileInput.click();
});

mediaFileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  stagedMediaFileName = file.name;
  const reader = new FileReader();
  reader.onload = () => {
    stagedMediaBase64 = reader.result;
    mediaPreviewImg.src = stagedMediaBase64;
    mediaFileName.textContent = file.name;
    mediaStagingBar.style.display = "block";
    chatMessageInput.focus();
  };
  reader.readAsDataURL(file);
});

function clearStagedMedia() {
  stagedMediaBase64 = null;
  stagedMediaFileName = "";
  mediaFileInput.value = "";
  mediaStagingBar.style.display = "none";
}

clearMediaBtn.addEventListener("click", clearStagedMedia);

// 8. Event Listeners & Shortcuts
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

// Real-Time Polling Loop (Every 2 seconds for live message stream & user activity)
function startPolling() {
  setInterval(async () => {
    if (isAutoPollActive) {
      if (activeTargetUser) {
        await loadConversationMessages();
      }
      // Also poll user list to update recent order and new incoming messages
      await fetchUsers();
    }
  }, 2000);
}

// Initialization
document.addEventListener("DOMContentLoaded", () => {
  startLiveClock();
  fetchUsers();
  startPolling();
  refreshIcons();
});
