// AtharvaOS Warm Editorial Mini App Controller

const API_BASE_URL = "https://ged2lb24hngndlzk5b73dmvdqy0ydsmo.lambda-url.ap-south-1.on.aws/api";
const OWNER_CHAT_ID = "5275149287";

// 1. Initialize Telegram WebApp SDK
const tg = window.Telegram?.WebApp;

if (tg) {
  tg.ready();
  tg.expand();
  // Auto-detect Telegram color scheme
  if (tg.colorScheme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  }
}

// 2. User Context
let currentUser = {
  id: OWNER_CHAT_ID,
  first_name: "Atharva",
  username: "op_athu",
};

if (tg?.initDataUnsafe?.user) {
  currentUser = tg.initDataUnsafe.user;
}

// State
let allTasks = [];
let activeFilter = "all";
let searchQuery = "";
let currentTheme = document.documentElement.getAttribute("data-theme") || "light";

// DOM Elements
const userAvatar = document.getElementById("userAvatar");
const greetingText = document.getElementById("greetingText");
const taskListEl = document.getElementById("taskList");
const progressCircle = document.getElementById("progressCircle");
const progressPercent = document.getElementById("progressPercent");
const taskSummaryHeadline = document.getElementById("taskSummaryHeadline");
const searchInput = document.getElementById("searchInput");
const filterTabs = document.querySelectorAll(".pill-tab");
const adminTabBtn = document.getElementById("adminTabBtn");
const tasksView = document.getElementById("tasksView");
const adminView = document.getElementById("adminView");
const adminContent = document.getElementById("adminContent");
const addModal = document.getElementById("addModal");
const openAddModalBtn = document.getElementById("openAddModalBtn");
const closeAddModalBtn = document.getElementById("closeAddModalBtn");
const addTaskForm = document.getElementById("addTaskForm");
const themeToggleBtn = document.getElementById("themeToggleBtn");

// Initialize User Profile
function setupUserProfile() {
  const initial = (currentUser.first_name || "A").charAt(0).toUpperCase();
  userAvatar.textContent = initial;
  greetingText.textContent = `Good day, ${currentUser.first_name || "Champ"}`;

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

// Theme Toggle
themeToggleBtn.addEventListener("click", () => {
  triggerHaptic("light");
  currentTheme = currentTheme === "dark" ? "light" : "dark";
  if (currentTheme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    themeToggleBtn.textContent = "☀️";
  } else {
    document.documentElement.removeAttribute("data-theme");
    themeToggleBtn.textContent = "🌙";
  }
});

// Fetch Tasks from API
async function fetchTasks() {
  try {
    const res = await fetch(`${API_BASE_URL}/tasks?chatId=${currentUser.id}`);
    const data = await res.json();

    if (data && data.tasks) {
      allTasks = data.tasks;
      updateProgress(data.stats);
      renderTasks();
    }
  } catch (err) {
    console.error("Failed to load tasks:", err);
    if (allTasks.length === 0) {
      allTasks = [
        {
          _id: "demo1",
          type: "task",
          content: "Welcome to AtharvaOS! Tap the checkbox to complete this task.",
          completed: false,
          priority: "high",
          tags: ["welcome"],
        },
      ];
      updateProgress({ total: 1, completed: 0, progress: 0 });
      renderTasks();
    }
  }
}

// Update Progress Ring (Circumference 213.6 for r=34)
function updateProgress(stats) {
  if (!stats) return;
  const total = stats.total || 0;
  const completed = stats.completed || 0;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  const circumference = 213.6;
  const offset = circumference - (percent / 100) * circumference;

  progressCircle.style.strokeDashoffset = offset;
  progressPercent.textContent = `${percent}%`;
  taskSummaryHeadline.textContent = `${completed} of ${total} Completed`;
}

// Render Tasks
function renderTasks() {
  taskListEl.innerHTML = "";

  const filtered = allTasks.filter((task) => {
    const matchesFilter = activeFilter === "all" || task.type === activeFilter;
    const matchesSearch =
      !searchQuery ||
      task.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.tags && task.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));
    return matchesFilter && matchesSearch;
  });

  if (filtered.length === 0) {
    taskListEl.innerHTML = `
      <div class="empty-state-editorial">
        <div class="empty-symbol">🖋️</div>
        <h3 class="display-serif">Your Slate is Clear</h3>
        <p>No active items in this category. Enjoy your stillness or plan your next breakthrough.</p>
      </div>
    `;
    return;
  }

  filtered.forEach((task) => {
    const card = document.createElement("div");
    card.className = `item-card ${task.completed ? "completed" : ""}`;
    card.dataset.type = task.type || "task";
    card.dataset.id = task._id;

    // Due date
    let dueHtml = "";
    if (task.date) {
      const dueDate = new Date(task.date);
      const daysLeft = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));
      const formatted = dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      let dueClass = "due-indicator";
      let dueText = `📅 ${formatted}`;
      if (daysLeft < 0) {
        dueClass += " due-overdue";
        dueText = `⚠️ Overdue (${formatted})`;
      } else if (daysLeft === 0) {
        dueClass += " due-today";
        dueText = `🔥 Due Today`;
      }
      dueHtml = `<span class="${dueClass}">${dueText}</span>`;
    }

    // Priority badge
    const priority = task.priority || "medium";
    const priorityLabel = priority === "high" ? "🔥 High" : priority === "low" ? "🟢 Low" : "⚡ Med";
    const priorityBadge = `<span class="meta-badge badge-${priority}">${priorityLabel}</span>`;

    // Tags
    const tagsHtml = (task.tags || [])
      .map((tag) => `<span class="meta-badge badge-tag">#${escapeHtml(tag)}</span>`)
      .join("");

    card.innerHTML = `
      <button class="editorial-checkbox" aria-label="Toggle completion"></button>
      <div class="card-body">
        <div class="card-top-row">
          <span class="card-title">${escapeHtml(task.content)}</span>
          <button class="delete-action-btn" title="Delete item">🗑️</button>
        </div>
        <div class="card-meta-row">
          ${priorityBadge}
          ${dueHtml}
          ${tagsHtml}
        </div>
      </div>
    `;

    // Checkbox toggle
    const checkbox = card.querySelector(".editorial-checkbox");
    checkbox.addEventListener("click", () => toggleTask(task));

    // Delete button
    const delBtn = card.querySelector(".delete-action-btn");
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteTask(task._id);
    });

    taskListEl.appendChild(card);
  });
}

// Toggle Task
async function toggleTask(task) {
  triggerHaptic(task.completed ? "light" : "success");
  const newStatus = !task.completed;
  task.completed = newStatus;

  if (newStatus && typeof confetti === "function") {
    confetti({
      particleCount: 45,
      spread: 65,
      origin: { y: 0.8 },
      colors: ["#C44A1A", "#BAABFF", "#2D7A3E", "#E89B5C"],
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
        date: dateVal || null,
        priority,
        tags,
      }),
    });
    const data = await res.json();
    if (data && data.task) {
      tempTask._id = data.task._id;
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
        <div class="stat-row-grid">
          <div class="stat-box">
            <span class="eyebrow-label">TOTAL USERS</span>
            <span class="big-stat-number">${data.totalUsers}</span>
          </div>
          <div class="stat-box">
            <span class="eyebrow-label">TOTAL TASKS</span>
            <span class="big-stat-number">${data.totalTasks}</span>
          </div>
          <div class="stat-box">
            <span class="eyebrow-label">COMPLETED</span>
            <span class="big-stat-number" style="color:rgb(var(--color-success))">${data.completedTasks}</span>
          </div>
          <div class="stat-box">
            <span class="eyebrow-label">AI MESSAGES</span>
            <span class="big-stat-number" style="color:rgb(var(--color-accent))">${data.totalMessages}</span>
          </div>
        </div>

        <div class="users-list-card">
          <span class="eyebrow-label">REGISTERED USER ROSTER</span>
          <h4 class="users-list-title display-serif">Active Profiles</h4>
          ${(data.users || [])
            .map(
              (u) => `
            <div class="user-row">
              <div>
                <strong>${escapeHtml(u.firstName)}</strong>
                ${u.username ? `<span style="color:rgb(var(--color-muted))"> (@${escapeHtml(u.username)})</span>` : ""}
              </div>
              <span style="color:rgb(var(--color-muted)); font-size: 0.78rem;">
                ${new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </div>
          `
            )
            .join("")}
        </div>
      `;
    } else {
      adminContent.innerHTML = `<p style="color:rgb(var(--color-danger))">Access restricted or error loading stats.</p>`;
    }
  } catch (err) {
    adminContent.innerHTML = `<p style="color:rgb(var(--color-danger))">Failed loading analytics: ${err.message}</p>`;
  }
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
