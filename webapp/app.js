// AtharvaOS Dual-Color (Flo 101) Mini App Controller with Project-Task Hierarchy Support

const API_BASE_URL = "https://ged2lb24hngndlzk5b73dmvdqy0ydsmo.lambda-url.ap-south-1.on.aws/api";
const OWNER_CHAT_ID = "5275149287";

// 1. Initialize Telegram WebApp SDK
const tg = window.Telegram?.WebApp;

if (tg) {
  tg.ready();
  tg.expand();
}

// 2. User Context
let currentUser = {
  id: OWNER_CHAT_ID,
  first_name: "Atharva",
  username: "op_athu",
  photo_url: null,
};

if (tg?.initDataUnsafe?.user) {
  currentUser = {
    ...currentUser,
    ...tg.initDataUnsafe.user,
  };
}

// State
let allTasks = [];
let activeFilter = "all";
let searchQuery = "";
let currentOpenConvoChatId = null;

// DOM Elements
const userAvatar = document.getElementById("userAvatar");
const greetingText = document.getElementById("greetingText");
const taskListEl = document.getElementById("taskList");
const progressCircle = document.getElementById("progressCircle");
const progressPercent = document.getElementById("progressPercent");
const taskSummaryHeadline = document.getElementById("taskSummaryHeadline");
const searchInput = document.getElementById("searchInput");
const filterTabs = document.querySelectorAll(".pill-btn");
const adminTabBtn = document.getElementById("adminTabBtn");
const tasksView = document.getElementById("tasksView");
const adminView = document.getElementById("adminView");
const adminContent = document.getElementById("adminContent");
const addModal = document.getElementById("addModal");
const openAddModalBtn = document.getElementById("openAddModalBtn");
const closeAddModalBtn = document.getElementById("closeAddModalBtn");
const addTaskForm = document.getElementById("addTaskForm");
const taskProjectInput = document.getElementById("taskProjectInput");
const taskUrlInput = document.getElementById("taskUrlInput");

// Conversation Modal Elements
const convoModal = document.getElementById("convoModal");
const closeConvoModalBtn = document.getElementById("closeConvoModalBtn");
const convoAvatar = document.getElementById("convoAvatar");
const convoUserName = document.getElementById("convoUserName");
const convoUserMeta = document.getElementById("convoUserMeta");
const convoMessagesList = document.getElementById("convoMessagesList");
const refreshConvoBtn = document.getElementById("refreshConvoBtn");

// Helper to refresh Lucide icons
function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

// Render User Avatar (Real Telegram Profile Photo or Initial)
function renderAvatar(photoUrl, name) {
  const safeName = name || "Champ";
  const initial = safeName.charAt(0).toUpperCase();

  if (photoUrl) {
    userAvatar.innerHTML = `<img src="${photoUrl}" alt="${safeName}" class="avatar-photo" onerror="this.parentElement.textContent='${initial}'">`;
  } else {
    userAvatar.textContent = initial;
  }
}

// Initialize User Profile
function setupUserProfile() {
  const name = currentUser.first_name || "Champ";
  greetingText.textContent = `Good day, ${name}`;
  renderAvatar(currentUser.photo_url, name);

  // Always show Admin Tab for owner
  if (String(currentUser.id) === OWNER_CHAT_ID || String(currentUser.id) === "5275149287") {
    adminTabBtn.style.display = "inline-flex";
  }
}

// Haptic feedback helper
function triggerHaptic(type = "light") {
  if (tg?.HapticFeedback) {
    if (type === "success") tg.HapticFeedback.notificationOccurred("success");
    else if (type === "medium") tg.HapticFeedback.impactOccurred("medium");
    else tg.HapticFeedback.impactOccurred("light");
  }
}

// Fetch Tasks from API
async function fetchTasks() {
  try {
    const res = await fetch(`${API_BASE_URL}/tasks?chatId=${currentUser.id}`);
    const data = await res.json();

    if (data) {
      if (data.user) {
        if (data.user.photoUrl && !currentUser.photo_url) {
          currentUser.photo_url = data.user.photoUrl;
          renderAvatar(data.user.photoUrl, currentUser.first_name);
        }
      }

      if (data.tasks) {
        allTasks = data.tasks;
        updateProgress(data.stats);
        renderTasks();
      }
    }
  } catch (err) {
    console.error("Failed to load tasks:", err);
    if (allTasks.length === 0) {
      allTasks = [
        {
          _id: "demo1",
          type: "project",
          content: "Blockchain Land Registry System",
          completed: false,
          priority: "high",
          tags: ["web3"],
        },
        {
          _id: "demo2",
          type: "video",
          content: "Next.js 15 & Solana Web3 Tutorial",
          url: "https://youtube.com",
          completed: false,
          priority: "medium",
          tags: ["video", "study"],
        },
      ];
      updateProgress({ total: 2, completed: 0, progress: 0 });
      renderTasks();
    }
  }
}

// Update Progress Ring (Circumference 201.06 for r=32)
function updateProgress(stats) {
  if (!stats) return;
  const total = stats.total || 0;
  const completed = stats.completed || 0;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  const circumference = 201.06;
  const offset = circumference - (percent / 100) * circumference;

  progressCircle.style.strokeDashoffset = offset;
  progressPercent.textContent = `${percent}%`;
  taskSummaryHeadline.textContent = `${completed} of ${total} Completed`;
}

// Render Tasks with Project Badges, Videos & Grouping
function renderTasks() {
  taskListEl.innerHTML = "";

  const filtered = allTasks.filter((task) => {
    let matchesFilter = false;
    if (activeFilter === "all") {
      matchesFilter = true;
    } else if (activeFilter === "project") {
      matchesFilter = task.type === "project" || Boolean(task.projectName);
    } else if (activeFilter === "video") {
      matchesFilter = task.type === "video" || task.type === "link" || Boolean(task.url);
    } else {
      matchesFilter = task.type === activeFilter;
    }

    const matchesSearch =
      !searchQuery ||
      task.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.url && task.url.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (task.projectName && task.projectName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (task.tags && task.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));

    return matchesFilter && matchesSearch;
  });

  if (filtered.length === 0) {
    taskListEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon-wrap">
          <i data-lucide="inbox" class="empty-svg-icon"></i>
        </div>
        <h3 class="display-serif">Your Slate is Clear</h3>
        <p>No active items in this category. Enjoy your stillness or plan your next breakthrough.</p>
      </div>
    `;
    refreshIcons();
    return;
  }

  filtered.forEach((task) => {
    const card = document.createElement("div");
    const isProject = task.type === "project";
    const isVideo = task.type === "video" || task.type === "link" || Boolean(task.url);
    card.className = `item-card ${isProject ? "project-card" : ""} ${isVideo ? "video-card" : ""} ${task.completed ? "completed" : ""}`;
    card.dataset.id = task._id;

    // Due date
    let dueHtml = "";
    if (task.date) {
      const dueDate = new Date(task.date);
      const daysLeft = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));
      const formatted = dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      let dueClass = "due-indicator";
      let dueText = `<i data-lucide="calendar" class="icon-inline"></i> ${formatted}`;
      if (daysLeft < 0) {
        dueClass += " due-overdue";
        dueText = `<i data-lucide="alert-circle" class="icon-inline"></i> Overdue (${formatted})`;
      } else if (daysLeft === 0) {
        dueClass += " due-today";
        dueText = `<i data-lucide="clock" class="icon-inline"></i> Due Today`;
      }
      dueHtml = `<span class="${dueClass}">${dueText}</span>`;
    }

    // Priority badge
    const priority = task.priority || "medium";
    const priorityLabel = priority === "high" ? "High" : priority === "low" ? "Low" : "Med";
    const priorityBadge = `<span class="badge badge-${priority}">${priorityLabel}</span>`;

    // Type / Project / Video Badge
    let typeBadge = "";
    if (isProject) {
      typeBadge = `<span class="badge badge-project"><i data-lucide="folder" class="icon-inline"></i> PROJECT</span>`;
    } else if (isVideo) {
      typeBadge = `<span class="badge badge-video"><i data-lucide="video" class="icon-inline"></i> SAVED LINK</span>`;
    } else if (task.projectName) {
      typeBadge = `<span class="badge badge-parent-project"><i data-lucide="folder-git-2" class="icon-inline"></i> ${escapeHtml(task.projectName)}</span>`;
    }

    // URL Button
    let urlBtnHtml = "";
    if (task.url) {
      urlBtnHtml = `
        <a href="${escapeHtml(task.url)}" target="_blank" rel="noopener noreferrer" class="link-action-pill" onclick="event.stopPropagation()">
          <i data-lucide="external-link" class="icon-inline"></i>
          <span>Open Link</span>
        </a>
      `;
    }

    // Tags
    const tagsHtml = (task.tags || [])
      .map((tag) => `<span class="badge badge-tag">#${escapeHtml(tag)}</span>`)
      .join("");

    card.innerHTML = `
      <button class="custom-checkbox" aria-label="Toggle completion"></button>
      <div class="card-body">
        <div class="card-top-row">
          <span class="card-title">${escapeHtml(task.content)}</span>
          <button class="delete-btn" title="Delete item" aria-label="Delete">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
        <div class="card-meta-row">
          ${typeBadge}
          ${priorityBadge}
          ${dueHtml}
          ${urlBtnHtml}
          ${tagsHtml}
        </div>
      </div>
    `;

    // Checkbox toggle
    const checkbox = card.querySelector(".custom-checkbox");
    checkbox.addEventListener("click", () => toggleTask(task));

    // Delete button
    const delBtn = card.querySelector(".delete-btn");
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteTask(task._id);
    });

    taskListEl.appendChild(card);
  });

  refreshIcons();
}

// Toggle Task
async function toggleTask(task) {
  triggerHaptic(task.completed ? "light" : "success");
  const newStatus = !task.completed;
  task.completed = newStatus;

  if (newStatus && typeof confetti === "function") {
    confetti({
      particleCount: 50,
      spread: 70,
      origin: { y: 0.8 },
      colors: ["#BAABFF", "#14110E", "#3FA366", "#E89A3C"],
    });
  }

  const total = allTasks.length;
  const completed = allTasks.filter((t) => t.completed).length;
  updateProgress({ total, completed });
  renderTasks();

  try {
    await fetch(`${API_BASE_URL}/tasks/toggle`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: task._id, chatId: currentUser.id, completed: newStatus }),
    });
  } catch (err) {
    console.error("Failed to sync status:", err);
  }
}

// Delete Task
async function deleteTask(taskId) {
  triggerHaptic("medium");
  allTasks = allTasks.filter((t) => t._id !== taskId);

  const total = allTasks.length;
  const completed = allTasks.filter((t) => t.completed).length;
  updateProgress({ total, completed });
  renderTasks();

  try {
    await fetch(`${API_BASE_URL}/tasks`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: taskId, chatId: currentUser.id }),
    });
  } catch (err) {
    console.error("Failed to delete task:", err);
  }
}

// Add Task Form
addTaskForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  triggerHaptic("success");

  const type = document.querySelector('input[name="type"]:checked')?.value || "task";
  const content = document.getElementById("taskContentInput").value.trim();
  const projectName = taskProjectInput ? taskProjectInput.value.trim() : "";
  const url = taskUrlInput ? taskUrlInput.value.trim() : "";
  const dateVal = document.getElementById("taskDateInput").value;
  const priority = document.getElementById("taskPriorityInput").value;
  const rawTags = document.getElementById("taskTagsInput").value;
  const tags = rawTags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (!content) return;

  const tempTask = {
    _id: "temp_" + Date.now(),
    type,
    content,
    url: url || "",
    projectName: type !== "project" ? projectName : "",
    date: dateVal ? new Date(dateVal).toISOString() : null,
    priority,
    tags,
    completed: false,
  };

  allTasks.unshift(tempTask);
  const total = allTasks.length;
  const completed = allTasks.filter((t) => t.completed).length;
  updateProgress({ total, completed });
  renderTasks();

  closeModal();
  addTaskForm.reset();

  try {
    const res = await fetch(`${API_BASE_URL}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId: currentUser.id,
        type,
        content,
        url: url || "",
        projectName: type !== "project" ? projectName : "",
        date: dateVal || null,
        priority,
        tags,
      }),
    });
    const data = await res.json();
    if (data && data.task) {
      tempTask._id = data.task._id;
      tempTask.projectId = data.task.projectId;
      tempTask.projectName = data.task.projectName;
      tempTask.url = data.task.url;
    }
  } catch (err) {
    console.error("Failed to create task:", err);
  }
});

// Fetch Admin Stats (Real Live Data)
async function fetchAdminStats() {
  adminContent.innerHTML = `
    <div class="skeleton-card" aria-busy="true"></div>
    <div class="skeleton-card" aria-busy="true"></div>
  `;

  try {
    const res = await fetch(`${API_BASE_URL}/stats?chatId=${currentUser.id}`);
    const data = await res.json();

    if (data && data.totalUsers !== undefined) {
      adminContent.innerHTML = `
        <div class="stat-grid">
          <div class="stat-box">
            <div class="stat-header">
              <span class="eyebrow">TOTAL USERS</span>
              <i data-lucide="users" class="stat-icon"></i>
            </div>
            <span class="stat-num">${data.totalUsers}</span>
          </div>
          <div class="stat-box">
            <div class="stat-header">
              <span class="eyebrow">TOTAL TASKS</span>
              <i data-lucide="check-square" class="stat-icon"></i>
            </div>
            <span class="stat-num">${data.totalTasks}</span>
          </div>
          <div class="stat-box">
            <div class="stat-header">
              <span class="eyebrow">COMPLETED</span>
              <i data-lucide="check-circle-2" class="stat-icon" style="color:var(--status-green)"></i>
            </div>
            <span class="stat-num" style="color:var(--status-green)">${data.completedTasks}</span>
          </div>
          <div class="stat-box">
            <div class="stat-header">
              <span class="eyebrow">AI MESSAGES</span>
              <i data-lucide="message-square" class="stat-icon" style="color:var(--flo-lavender-dark)"></i>
            </div>
            <span class="stat-num" style="color:var(--flo-lavender-dark)">${data.totalMessages}</span>
          </div>
        </div>

        <div class="users-list-card">
          <div class="user-list-header">
            <span class="eyebrow">USER CONVERSATIONS & PROFILES</span>
            <i data-lucide="messages-square" class="stat-icon"></i>
          </div>
          <h4 class="display-serif" style="margin-bottom: 8px;">Tap User to View Full Chat</h4>
          ${(data.users || [])
            .map(
              (u) => `
            <div class="user-row clickable-user-row" data-chat-id="${u.telegramId}" data-name="${escapeHtml(u.firstName)}">
              <div class="user-row-left">
                <div class="mini-avatar">${escapeHtml(u.firstName.charAt(0).toUpperCase())}</div>
                <div class="user-text-meta">
                  <div class="user-name-line">
                    <strong>${escapeHtml(u.firstName)}</strong>
                    ${u.username ? `<span style="color:var(--ink-muted); font-size:0.8rem;"> (@${escapeHtml(u.username)})</span>` : ""}
                    <span class="msg-count-pill">${u.messageCount || 0} msgs</span>
                  </div>
                  <div class="user-last-msg">${escapeHtml(u.lastMessageSnippet || "No message")}</div>
                </div>
              </div>
              <button class="convo-open-btn" aria-label="Open conversation">
                <i data-lucide="chevron-right"></i>
              </button>
            </div>
          `
            )
            .join("")}
        </div>
      `;

      // Wire click events on user rows to open full conversation history
      document.querySelectorAll(".clickable-user-row").forEach((row) => {
        row.addEventListener("click", () => {
          triggerHaptic("medium");
          const targetId = row.dataset.chatId;
          const targetName = row.dataset.name;
          openConversation(targetId, targetName);
        });
      });

      refreshIcons();
    } else {
      adminContent.innerHTML = `<p style="color:var(--badge-high)">Access restricted or error loading stats.</p>`;
    }
  } catch (err) {
    adminContent.innerHTML = `<p style="color:var(--badge-high)">Failed loading analytics: ${err.message}</p>`;
  }
}

// Open and Fetch User Conversation History
async function openConversation(targetChatId, targetName) {
  currentOpenConvoChatId = targetChatId;
  convoUserName.textContent = targetName || "User Chat";
  convoUserMeta.textContent = `Telegram ID: ${targetChatId}`;
  convoAvatar.textContent = (targetName || "U").charAt(0).toUpperCase();

  convoModal.classList.add("active");
  convoModal.setAttribute("aria-hidden", "false");

  convoMessagesList.innerHTML = `
    <div class="skeleton-card" aria-busy="true"></div>
    <div class="skeleton-card" aria-busy="true"></div>
  `;

  await loadConversationMessages(targetChatId);
}

// Load Conversation Messages
async function loadConversationMessages(targetChatId) {
  try {
    const res = await fetch(
      `${API_BASE_URL}/admin/conversations?chatId=${currentUser.id}&targetChatId=${targetChatId}`
    );
    const data = await res.json();

    if (data && data.messages) {
      if (data.messages.length === 0) {
        convoMessagesList.innerHTML = `
          <div class="empty-state" style="padding: 30px 10px;">
            <div class="empty-icon-wrap" style="width: 48px; height: 48px;">
              <i data-lucide="message-circle-off" class="empty-svg-icon" style="width: 24px; height: 24px;"></i>
            </div>
            <h4 class="display-serif">No Messages Yet</h4>
            <p>This user hasn't chatted with AtharvaOS yet.</p>
          </div>
        `;
        refreshIcons();
        return;
      }

      convoMessagesList.innerHTML = data.messages
        .map((msg) => {
          const isUser = msg.role === "user";
          const roleLabel = isUser ? "User" : "AtharvaOS";
          const timeStr = new Date(msg.createdAt).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          });

          return `
            <div class="chat-bubble-wrap ${isUser ? "user-bubble-wrap" : "bot-bubble-wrap"}">
              <div class="chat-bubble-header">
                <span class="chat-sender-name">${roleLabel}</span>
                <span class="chat-time">${timeStr}</span>
              </div>
              <div class="chat-bubble-body">${escapeHtml(msg.content)}</div>
            </div>
          `;
        })
        .join("");

      // Scroll to bottom
      convoMessagesList.scrollTop = convoMessagesList.scrollHeight;
    } else {
      convoMessagesList.innerHTML = `<p style="color:var(--badge-high); padding: 20px;">${data.error || "Failed to load conversation."}</p>`;
    }
  } catch (err) {
    convoMessagesList.innerHTML = `<p style="color:var(--badge-high); padding: 20px;">Error loading conversation: ${err.message}</p>`;
  }

  refreshIcons();
}

// Refresh Conversation Button
refreshConvoBtn.addEventListener("click", () => {
  triggerHaptic("light");
  if (currentOpenConvoChatId) {
    loadConversationMessages(currentOpenConvoChatId);
  }
});

// Close Conversation Modal
closeConvoModalBtn.addEventListener("click", closeConvoModal);
convoModal.addEventListener("click", (e) => {
  if (e.target === convoModal) closeConvoModal();
});

function closeConvoModal() {
  triggerHaptic("light");
  convoModal.classList.remove("active");
  convoModal.setAttribute("aria-hidden", "true");
  currentOpenConvoChatId = null;
}

// Filter Tabs Handling
filterTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    triggerHaptic("light");
    filterTabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");

    const filter = tab.dataset.filter;
    activeFilter = filter;

    if (filter === "admin") {
      tasksView.style.display = "none";
      adminView.style.display = "block";
      fetchAdminStats();
    } else {
      adminView.style.display = "none";
      tasksView.style.display = "block";
      renderTasks();
    }
  });
});

// Search Filter
searchInput.addEventListener("input", (e) => {
  searchQuery = e.target.value;
  renderTasks();
});

// Modal Handlers
openAddModalBtn.addEventListener("click", () => {
  triggerHaptic("medium");
  addModal.classList.add("active");
  addModal.setAttribute("aria-hidden", "false");
});

closeAddModalBtn.addEventListener("click", closeModal);
addModal.addEventListener("click", (e) => {
  if (e.target === addModal) closeModal();
});

function closeModal() {
  triggerHaptic("light");
  addModal.classList.remove("active");
  addModal.setAttribute("aria-hidden", "true");
}

function escapeHtml(text) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return String(text || "").replace(/[&<>"']/g, (m) => map[m]);
}

// Initial Boot
setupUserProfile();
fetchTasks();
refreshIcons();
