// AtharvaOS Telegram Mini App Controller

const API_BASE_URL = "https://ged2lb24hngndlzk5b73dmvdqy0ydsmo.lambda-url.ap-south-1.on.aws/api";
const OWNER_CHAT_ID = "5275149287";

// 1. Initialize Telegram WebApp SDK
const tg = window.Telegram?.WebApp;

if (tg) {
  tg.ready();
  tg.expand(); // Open to full height inside Telegram
  document.body.classList.add("theme-tg");
}

// 2. Extract User Context
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

// DOM Elements
const userAvatar = document.getElementById("userAvatar");
const greetingText = document.getElementById("greetingText");
const taskListEl = document.getElementById("taskList");
const progressCircle = document.getElementById("progressCircle");
const progressPercent = document.getElementById("progressPercent");
const taskSummaryText = document.getElementById("taskSummaryText");
const searchInput = document.getElementById("searchInput");
const filterTabs = document.querySelectorAll(".tab-btn");
const adminTabBtn = document.getElementById("adminTabBtn");
const tasksView = document.getElementById("tasksView");
const adminView = document.getElementById("adminView");
const adminContent = document.getElementById("adminContent");
const addModal = document.getElementById("addModal");
const openAddModalBtn = document.getElementById("openAddModalBtn");
const closeAddModalBtn = document.getElementById("closeAddModalBtn");
const addTaskForm = document.getElementById("addTaskForm");

// Init UI with user profile
function setupUserProfile() {
  const initial = (currentUser.first_name || "A").charAt(0).toUpperCase();
  userAvatar.textContent = initial;
  greetingText.textContent = `Hey ${currentUser.first_name || "Champ"}! 👋`;

  // Show Admin Tab if owner
  if (String(currentUser.id) === OWNER_CHAT_ID) {
    adminTabBtn.style.display = "block";
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

    if (data && data.tasks) {
      allTasks = data.tasks;
      updateStats(data.stats);
      renderTasks();
    }
  } catch (err) {
    console.error("Failed to load tasks:", err);
    // Offline / Fallback sample data if network fails
    if (allTasks.length === 0) {
      allTasks = [
        {
          _id: "demo1",
          type: "task",
          content: "Welcome to AtharvaOS Mini App! Tap checkbox to test 🎉",
          completed: false,
          priority: "high",
          tags: ["quickstart"],
        },
      ];
      updateStats({ total: 1, completed: 0, progress: 0 });
      renderTasks();
    }
  }
}

// Update Circular Progress & Stats
function updateStats(stats) {
  if (!stats) return;
  const total = stats.total || 0;
  const completed = stats.completed || 0;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  // SVG Circumference: 2 * PI * 40 ≈ 251.2
  const circumference = 251.2;
  const offset = circumference - (percent / 100) * circumference;

  progressCircle.style.strokeDashoffset = offset;
  progressPercent.textContent = `${percent}%`;
  taskSummaryText.textContent = `${completed} of ${total} Completed`;
}

// Render Tasks
function renderTasks() {
  taskListEl.innerHTML = "";

  // Apply Filter & Search
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
      <div class="empty-state">
        <div class="empty-icon">🏖️</div>
        <h3>No items found!</h3>
        <p>All caught up or nothing matching your search. Enjoy your free time or add a new goal!</p>
      </div>
    `;
    return;
  }

  filtered.forEach((task) => {
    const card = document.createElement("div");
    card.className = `task-card ${task.completed ? "completed" : ""}`;
    card.dataset.id = task._id;

    // Due date label
    let dueHtml = "";
    if (task.date) {
      const dueDate = new Date(task.date);
      const daysLeft = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));
      const formatted = dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      let dueClass = "due-pill";
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
    const priorityBadge = `<span class="badge badge-${priority}">${priorityLabel}</span>`;

    // Tags
    const tagsHtml = (task.tags || [])
      .map((tag) => `<span class="badge badge-tag">#${tag}</span>`)
      .join("");

    card.innerHTML = `
      <button class="custom-checkbox" aria-label="Toggle task completion"></button>
      <div class="task-content">
        <div class="task-header-row">
          <span class="task-title">${escapeHtml(task.content)}</span>
          <div class="task-actions">
            <button class="delete-btn" title="Delete">🗑️</button>
          </div>
        </div>
        <div class="task-meta">
          ${priorityBadge}
          ${dueHtml}
          ${tagsHtml}
        </div>
      </div>
    `;

    // Click checkbox to toggle
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
}

// Toggle Task Complete
async function toggleTask(task) {
  triggerHaptic(task.completed ? "light" : "success");
  const newStatus = !task.completed;
  task.completed = newStatus;

  // Confetti on complete
  if (newStatus && typeof confetti === "function") {
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.8 },
      colors: ["#38bdf8", "#a855f7", "#10b981", "#f59e0b"],
    });
  }

  // Recalculate stats & re-render locally for instant UI response
  const total = allTasks.length;
  const completed = allTasks.filter((t) => t.completed).length;
  updateStats({ total, completed });
  renderTasks();

  // Sync with API
  try {
    await fetch(`${API_BASE_URL}/tasks/toggle`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: task._id, chatId: currentUser.id, completed: newStatus }),
    });
  } catch (err) {
    console.error("Failed to sync task toggle:", err);
  }
}

// Delete Task
async function deleteTask(taskId) {
  triggerHaptic("medium");
  allTasks = allTasks.filter((t) => t._id !== taskId);

  const total = allTasks.length;
  const completed = allTasks.filter((t) => t.completed).length;
  updateStats({ total, completed });
  renderTasks();

  try {
    await fetch(`${API_BASE_URL}/tasks`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: taskId, chatId: currentUser.id }),
    });
  } catch (err) {
    console.error("Failed to delete task on server:", err);
  }
}

// Add New Task
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
  updateStats({ total, completed });
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
    console.error("Failed to create task on server:", err);
  }
});

// Fetch Admin Stats
async function fetchAdminStats() {
  try {
    const res = await fetch(`${API_BASE_URL}/stats?chatId=${currentUser.id}`);
    const data = await res.json();

    if (data) {
      adminContent.innerHTML = `
        <div class="admin-metric-grid">
          <div class="admin-metric-card">
            <span class="num">${data.totalUsers || 0}</span>
            <span class="label">👥 Total Users</span>
          </div>
          <div class="admin-metric-card">
            <span class="num">${data.totalTasks || 0}</span>
            <span class="label">📋 Total Tasks</span>
          </div>
          <div class="admin-metric-card">
            <span class="num" style="color:var(--accent-emerald)">${data.completedTasks || 0}</span>
            <span class="label">✅ Completed Tasks</span>
          </div>
          <div class="admin-metric-card">
            <span class="num" style="color:var(--accent-purple)">${data.totalMessages || 0}</span>
            <span class="label">💬 AI Messages</span>
          </div>
        </div>

        <div class="admin-user-list">
          <h4>🌟 Registered Users</h4>
          ${(data.users || [])
            .map(
              (u) => `
            <div class="admin-user-item">
              <span><strong>${escapeHtml(u.firstName)}</strong> ${u.username ? `(@${escapeHtml(u.username)})` : ""}</span>
              <span style="color:var(--text-muted)">${new Date(u.createdAt).toLocaleDateString()}</span>
            </div>
          `
            )
            .join("")}
        </div>
      `;
    }
  } catch (err) {
    adminContent.innerHTML = `<p style="color:var(--accent-rose)">Failed to load admin stats: ${err.message}</p>`;
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

// Search input
searchInput.addEventListener("input", (e) => {
  searchQuery = e.target.value;
  renderTasks();
});

// Modal open / close
openAddModalBtn.addEventListener("click", () => {
  triggerHaptic("medium");
  addModal.classList.add("active");
});

closeAddModalBtn.addEventListener("click", closeModal);
addModal.addEventListener("click", (e) => {
  if (e.target === addModal) closeModal();
});

function closeModal() {
  triggerHaptic("light");
  addModal.classList.remove("active");
}

function escapeHtml(text) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return String(text || "").replace(/[&<>"']/g, (m) => map[m]);
}

// Initial Boot
setupUserProfile();
fetchTasks();
