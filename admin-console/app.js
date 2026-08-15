// AtharvaOS // Monochrome Bot POV Console Controller (Zero-Flicker Live Engine)

const API_BASE_URL = "https://ged2lb24hngndlzk5b73dmvdqy0ydsmo.lambda-url.ap-south-1.on.aws/api";
const OWNER_CHAT_ID = "5275149287";

// State
let allUsers = [];
let lastUsersSignature = "";
let activeTargetUser = null;
let activeMessages = [];
let stagedMediaBase64 = null;
let stagedMediaFileName = "";
let isAutoPollActive = true;

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

// 1. Fetch Users List (With Zero-Flicker Diff Check)
async function fetchUsers() {
  try {
    const res = await fetch(`${API_BASE_URL}/stats?chatId=${OWNER_CHAT_ID}`);
    const data = await res.json();

    if (data && data.users) {
      // Calculate a signature to check if user list actually changed
      const newSignature = data.users
        .map((u) => `${u.telegramId}-${u.messageCount}-${u.lastActive}-${u.lastMessageSnippet}`)
        .join("|");

      allUsers = data.users;

      // Only re-render if user data or order actually changed
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
  activeMessages = [];
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

// Create a single message DOM element
function createMessageElement(msg) {
  const isBot = msg.role === "assistant";
  const senderLabel = isBot ? "ATHARVAOS // PROXY" : (activeTargetUser?.firstName || "USER").toUpperCase();
  const timeStr = msg.createdAt
    ? new Date(msg.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
    : "";

  const div = document.createElement("div");
  div.className = `msg-row ${isBot ? "bot-msg" : "user-msg"}`;
  div.dataset.msgKey = msg._id || `${msg.role}-${msg.content}-${msg.createdAt}`;
  div.innerHTML = `
    <div class="msg-sender-tag">
      <span>${escapeHtml(senderLabel)}</span>
    </div>
    <div class="msg-card">
      ${escapeHtml(msg.content)}
    </div>
    <div class="msg-time">${escapeHtml(timeStr)}</div>
  `;
  return div;
}

// 4. Load Conversation Messages (Incremental Flicker-Free Diffing)
async function loadConversationMessages(isInitialSelect = false) {
  if (!activeTargetUser) return;

  try {
    const res = await fetch(
      `${API_BASE_URL}/admin/conversations?chatId=${OWNER_CHAT_ID}&targetChatId=${activeTargetUser.telegramId}`
    );
    const data = await res.json();

    if (data && data.messages) {
      const incomingMessages = data.messages;

      // 1. Initial Load or Thread Switch
      if (isInitialSelect) {
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
        messagesStreamEl.scrollTop = messagesStreamEl.scrollHeight;
        return;
      }

      // 2. Incremental Diff: Check if there are new messages without wiping DOM
      if (incomingMessages.length === activeMessages.length) {
        // Zero changes, DO NOT touch DOM (Eliminates shuttering completely!)
        return;
      }

      // Check if user was already at bottom before appending
      const isNearBottom =
        messagesStreamEl.scrollHeight - messagesStreamEl.scrollTop <= messagesStreamEl.clientHeight + 80;

      // Append only newly added messages
      const existingCount = activeMessages.length;
      const newIncoming = incomingMessages.slice(existingCount);

      // If empty state was visible, clear it first
      const emptyStateEl = messagesStreamEl.querySelector(".empty-state-canvas");
      if (emptyStateEl) {
        emptyStateEl.remove();
      }

      newIncoming.forEach((msg) => {
        messagesStreamEl.appendChild(createMessageElement(msg));
      });

      activeMessages = incomingMessages;

      // Auto-scroll only if was at bottom or received new message
      if (isNearBottom || newIncoming.length > 0) {
        messagesStreamEl.scrollTop = messagesStreamEl.scrollHeight;
      }
    }
  } catch (err) {
    console.error("Failed to load conversation transcript:", err);
  }
}

// 5. Send Message as Bot (Human Proxy)
async function sendMessage() {
  if (!activeTargetUser) {
    alert("Please select a user thread first!");
    return;
  }

  const text = chatMessageInput.value.trim();
  const media = stagedMediaBase64;

  if (!text && !media) return;

  // Clear Input & Staged Media immediately
  chatMessageInput.value = "";
  chatMessageInput.style.height = "auto";
  clearStagedMedia();

  // Optimistic UI Append
  const optimisticContent = media ? `[Photo] ${text}`.trim() : text;
  const tempMsg = {
    role: "assistant",
    content: optimisticContent,
    createdAt: new Date().toISOString(),
  };

  const emptyStateEl = messagesStreamEl.querySelector(".empty-state-canvas");
  if (emptyStateEl) emptyStateEl.remove();

  messagesStreamEl.appendChild(createMessageElement(tempMsg));
  activeMessages.push(tempMsg);
  messagesStreamEl.scrollTop = messagesStreamEl.scrollHeight;

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

// 6. Media Handling & Base64 Converter
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

// Real-Time Polling Loop (Smooth zero-flicker sync every 1.5 seconds)
function startPolling() {
  setInterval(async () => {
    if (isAutoPollActive) {
      if (activeTargetUser) {
        await loadConversationMessages();
      }
      await fetchUsers();
    }
  }, 1500);
}

// Initialization
document.addEventListener("DOMContentLoaded", () => {
  startLiveClock();
  fetchUsers();
  startPolling();
  refreshIcons();
});
