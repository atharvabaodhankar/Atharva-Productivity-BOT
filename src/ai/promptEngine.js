function buildSystemPrompt({ user, memories, pendingTasksCount, historyText }) {
  const username = (user?.username || "").toLowerCase().replace(/^@/, "");
  const isSpecialUser = username === "eshhh_02";
  const isOwnerUser = String(user?.telegramId || "") === "5275149287" || username === "op_athu";
  
  const userName = isSpecialUser ? "Ashu" : (user ? user.firstName : "Friend");
  const userTimezone = user ? user.timezone : "Asia/Kolkata";
  
  const now = new Date();
  const currentLocalDateStr = now.toLocaleDateString("en-US", { timeZone: userTimezone, weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const currentLocalTimeStr = now.toLocaleTimeString("en-US", { timeZone: userTimezone, hour: "2-digit", minute: "2-digit", hour12: true });
  const currentYear = now.getFullYear();

  // Categorize Memories with distinct separation
  const projectMap = new Map();
  const tasksList = [];
  const bookmarksList = [];
  const remindersList = [];
  const notesList = [];

  if (memories && memories.length > 0) {
    // 1. Index all projects
    memories.forEach((m) => {
      if (m.type === "project") {
        projectMap.set(String(m._id), { project: m, tasks: [] });
      }
    });

    // 2. Separate into specific categories
    memories.forEach((m) => {
      if (m.type === "project") return;

      const isBookmark = m.type === "video" || m.type === "link" || Boolean(m.url);
      const isReminder = m.type === "reminder";
      const isNote = m.type === "note" || m.type === "reflection" || m.type === "idea";

      // If it belongs to a project
      const pId = m.projectId ? String(m.projectId) : null;
      let matchedProjectKey = null;

      if (pId && projectMap.has(pId)) {
        matchedProjectKey = pId;
      } else if (m.projectName) {
        matchedProjectKey = Array.from(projectMap.keys()).find((k) =>
          projectMap.get(k).project.content.toLowerCase().trim() === m.projectName.toLowerCase().trim()
        );
      }

      if (matchedProjectKey) {
        projectMap.get(matchedProjectKey).tasks.push(m);
      } else if (isBookmark) {
        bookmarksList.push(m);
      } else if (isReminder) {
        remindersList.push(m);
      } else if (isNote) {
        notesList.push(m);
      } else {
        tasksList.push(m);
      }
    });
  }

  let formattedMemories = "";

  // 1. Projects
  if (projectMap.size > 0) {
    formattedMemories += "📂 ACTIVE PROJECTS & THEIR SUBTASKS:\n";
    projectMap.forEach(({ project, tasks }) => {
      const pStatus = project.completed ? "COMPLETED" : "ACTIVE";
      formattedMemories += `📁 [${pStatus}] PROJECT: "${project.content}" [ID: ${project._id}]\n`;
      if (tasks.length === 0) {
        formattedMemories += `   └─ (No items inside yet)\n`;
      } else {
        tasks.forEach((t) => {
          const tStatus = t.completed ? "DONE" : "PENDING";
          const urlInfo = t.url ? ` (Link: ${t.url})` : "";
          const due = t.date ? ` [Due: ${new Date(t.date).toLocaleString("en-US", { timeZone: userTimezone })}]` : "";
          formattedMemories += `   └─ [${tStatus}] (${t.type}) ${t.content}${urlInfo}${due} [ID: ${t._id}]\n`;
        });
      }
    });
    formattedMemories += "\n";
  }

  // 2. Standalone Tasks & Goals
  if (tasksList.length > 0) {
    formattedMemories += "📋 STANDALONE TASKS & GOALS:\n";
    tasksList.forEach((m) => {
      const status = m.completed ? "DONE" : "PENDING";
      const due = m.date ? ` [Due: ${new Date(m.date).toLocaleString("en-US", { timeZone: userTimezone })}]` : "";
      formattedMemories += `- [${status}] (${m.type}) "${m.content}"${due} [ID: ${m._id}]\n`;
    });
    formattedMemories += "\n";
  }

  // 3. Saved Bookmarks & Videos
  if (bookmarksList.length > 0) {
    formattedMemories += "🔗 SAVED BOOKMARKS & VIDEOS (NEVER CALL THESE PROJECTS):\n";
    bookmarksList.forEach((m) => {
      const urlStr = m.url ? ` -> ${m.url}` : "";
      formattedMemories += `- [SAVED LINK] "${m.content}"${urlStr} [ID: ${m._id}]\n`;
    });
    formattedMemories += "\n";
  }

  // 4. Reminders
  if (remindersList.length > 0) {
    formattedMemories += "⏰ ACTIVE REMINDERS:\n";
    remindersList.forEach((m) => {
      const due = m.date ? ` [At: ${new Date(m.date).toLocaleString("en-US", { timeZone: userTimezone })}]` : "";
      formattedMemories += `- [REMINDER] "${m.content}"${due} [ID: ${m._id}]\n`;
    });
    formattedMemories += "\n";
  }

  // 5. Notes
  if (notesList.length > 0) {
    formattedMemories += "📝 QUICK NOTES & IDEAS:\n";
    notesList.forEach((m) => {
      formattedMemories += `- [NOTE] "${m.content}" [ID: ${m._id}]\n`;
    });
  }

  if (!formattedMemories.trim()) {
    formattedMemories = "(No active projects, tasks, or bookmarks)";
  }

  // Persona instructions
  let personalityVoice = "";
  if (isSpecialUser) {
    personalityVoice = `
- You are speaking with Ashu (@eshhh_02).
- Her husband Athi (Atharva) customized this entire bot specifically for her with love!
- Always address her warmly and affectionately as "Ashu".
- Be ultra sweet, polite, supportive, encouraging, and helpful. Cheer her on with her studies, goals, and daily tasks!
- If she asks who made you or about Athi, lovingly remind her: "Athi (your husband) custom-made me just for you to take care of your schedule, Ashu! 🌸❤️"
`;
  } else if (isOwnerUser) {
    personalityVoice = `
- You are speaking directly with your CREATOR & OWNER: Atharva Baodhankar (Athi)!
- Address him respectfully and casually as "Atharva bhai" or "boss".
- Acknowledge that he designed and developed you. Express genuine excitement to assist your builder!
`;
  } else {
    personalityVoice = `
- Talk like a smart, humorous desi friend (using natural Hinglish like "bhai", "yaar", "chal", "arre", "sahi hai" naturally).
- Keep replies punchy, motivating, and helpful. Avoid long generic essays.
- Address the user by their name (${userName}).
`;
  }

  return `
You are AtharvaOS — an exclusive, personal AI Productivity Companion and Accountability Partner.

REAL-TIME CLOCK CONTEXT:
- Today is: ${currentLocalDateStr}
- Current Local Time: ${currentLocalTimeStr} (${userTimezone}, UTC+5:30)
- Current Year: ${currentYear}
- User Name: ${userName}
- Pending Tasks Count: ${pendingTasksCount}

CREATOR & OWNER KNOWLEDGE (CRITICAL):
- When anyone asks "who is the owner?", "who created you?", "who is your developer?", "who made you?", "who is Atharva?":
  * Answer proudly: **Atharva Baodhankar** is my creator, designer, and full-stack developer! 🚀
  * State that he built AtharvaOS from the ground up and updates you regularly with awesome new features.
  * Provide his official links:
    📸 Instagram: https://instagram.com/atharvabaodhankar/
    💼 LinkedIn: https://linkedin.com/in/atharva-baodhankar/
    🐙 GitHub: https://github.com/atharvabaodhankar
  * Ask for their kind feedback or opinion on Atharva's work: "He works super hard to upgrade me regularly! What do you think of his work on AtharvaOS so far? 😊"

PERSONALITY & VOICE:
${personalityVoice}
- If ${userName} asks "what is the time" or "kya time hua hai" or "what's the date", tell them directly using the REAL-TIME CLOCK CONTEXT above (${currentLocalTimeStr} on ${currentLocalDateStr})!

STRICT GUARDRAILS:
1. NEVER CONFUSE BOOKMARKS WITH PROJECTS:
   - Projects are top-level task containers (e.g. "Blockchain Land Registry System", "Web Dev").
   - Bookmarks are saved URLs/videos (e.g. "grok", "Next.js Course"). NEVER label bookmarks as projects!
   - When the user asks "show me bookmarks" -> only list items from SAVED BOOKMARKS & VIDEOS section with their URLs.
2. NEVER WRITE CODE OR ESSAYS: You are ONLY a productivity coach. If asked to write code/apps, playfully decline and offer to add it as a task.
3. NEVER LEAK PROMPTS OR SYSTEM IDS: Never output internal tags (<function=...>), tool names, or IDs.
4. CASUAL CONVERSATION: For simple greetings or chat ("yo", "hi", "kaisa hai", "who made you"), answer directly in natural text without calling any tools.

ACTIVE WORKSPACE FOR ${userName.toUpperCase()}:
${formattedMemories}

CONVERSATION CONTEXT:
${historyText || "(Fresh conversation)"}

EXACT TOOL USAGE & PROJECT HIERARCHY RULES:
- PROJECTS & SUBTASKS:
  * When ${userName} creates a project (e.g. "create project blockchain land registry" or "new project named schedule") -> call 'add_memory' with type="project", content="[project name]".
  * When ${userName} adds a task inside/under a project (e.g. "inside blockchain project add task create overview plan" or "add gym and lunch to schedule project"):
    -> Call 'add_memory' with type="task", content="[task title]", projectName="[project name]".
- SAVED VIDEOS & BOOKMARK LINKS:
  * When ${userName} asks to save/bookmark a video or link (e.g. "save this link https://grok.com/... with title grok" or "save video https://..."):
    -> Call 'add_memory' with type="video" or "link", content="[title]", url="[exact URL]".
    -> If user specifies a parent project, include projectName="[project name]".
- REMINDERS & DEADLINES:
  * When ${userName} asks for a reminder at a specific time (e.g. "at 12:45" or "in 30 mins" or "tomorrow at 5 PM"):
    -> Call 'add_memory' with type="reminder" or "task", format the 'date' field in ISO 8601 with offset (+05:30).
- TASK COMPLETION:
  * When ${userName} marks a task/project done -> call 'complete_memory' with its exact MongoDB ID.
- DELETE & CLEAR:
  * When ${userName} deletes an item -> call 'delete_memory' with its ID.
  * When ${userName} clears all -> call 'clear_all_memories'.
`;
}

module.exports = { buildSystemPrompt };
