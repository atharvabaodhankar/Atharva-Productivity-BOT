// AtharvaOS // Monochrome Bot POV Console Controller

const API_BASE_URL = "https://ged2lb24hngndlzk5b73dmvdqy0ydsmo.lambda-url.ap-south-1.on.aws/api";
const OWNER_CHAT_ID = "5275149287";

// State
let allUsers = [];
let activeTargetUser = null;
let activeMessages = [];
let stagedMediaBase64 = null;
let stagedMediaFileName = "";
let isAutoPollActive = true;
let pollTimer = null;

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
  div.textContent = str;
  return div.innerHTML;
}

// 1. Fetch Users List
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
      const initial = (u.firstName || "U").charAt(0).toUpperCase();
      const isActive = activeTargetUser && String(activeTargetUser.telegramId) === String(u.telegramId);

      return `
        <div class="user-item ${isActive ? "active" : ""}" data-chat-id="${u.telegramId}">
          <div class="user-avatar-mini">${escapeHtml(initial)}</div>
          <div class="user-info-col">
            <div class="user-top-line">
              <span class="user-name-text">${escapeHtml(u.firstName)}</span>
              <span class="msg-count-tag">${u.messageCount || 0} msgs</span>
            </div>
            <div class="user-snippet-text">${escapeHtml(u.lastMessageSnippet || "No activity")}</div>
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
  renderUsersList(); // Update active highlights

  const name = user.firstName || "User";
  activeUserName.textContent = name;
  activeAvatar.textContent = name.charAt(0).toUpperCase();
  activeUserHandle.textContent = user.username ? `@${user.username}` : "NO HANDLE";
  activeUserMeta.textContent = `TG_ID: ${user.telegramId}`;

  messagesStreamEl.innerHTML = `
    <div class="skeleton-row" style="width:60%;"></div>
    <div class="skeleton-row" style="width:70%; align-self:flex-end;"></div>
  `;

  await loadConversationMessages();
  chatMessageInput.focus();
}

// 4. Load Conversation Messages
async function loadConversationMessages() {
  if (!activeTargetUser) return;

  try {
    const res = await fetch(
      `${API_BASE_URL}/admin/conversations?chatId=${OWNER_CHAT_ID}&targetChatId=${activeTargetUser.telegramId}`
    );
    const data = await res.json();

    if (data && data.messages) {
      activeMessages = data.messages;
      renderMessagesStream();
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

  // Scroll to bottom
  messagesStreamEl.scrollTop = messagesStreamEl.scrollHeight;
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
  renderMessagesStream();

  // Clear Input & Staged Media
  chatMessageInput.value = "";
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
manualRefreshBtn.addEventListener("click", loadConversationMessages);

// Toggle Auto-Polling
autoPollToggleBtn.addEventListener("click", () => {
  isAutoPollActive = !isAutoPollActive;
  autoPollToggleBtn.classList.toggle("active", isAutoPollActive);
  autoPollToggleBtn.querySelector("span").textContent = isAutoPollActive ? "AUTO-SYNC: ON" : "AUTO-SYNC: OFF";
});

// Real-Time Polling Loop (Every 3 seconds)
function startPolling() {
  setInterval(async () => {
    if (isAutoPollActive && activeTargetUser) {
      await loadConversationMessages();
    }
  }, 3000);
}

// Initialization
document.addEventListener("DOMContentLoaded", () => {
  startLiveClock();
  fetchUsers();
  startPolling();
  refreshIcons();
});
