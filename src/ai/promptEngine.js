function disinfectHistory(rawHistory) {
  if (!rawHistory) return "";

  const reasoningLinePatterns = [
    /^(?:assistant:\s*)?Looking at (the |active |conversation |workspace |user |context)/i,
    /^(?:assistant:\s*)?(The )?Last (user |assistant )message/i,
    /^(?:assistant:\s*)?Current time:/i,
    /^(?:assistant:\s*)?Contextually,/i,
    /^(?:assistant:\s*)?Given the (user|context|duplicates)/i,
    /^(?:assistant:\s*)?The user('s)? ("?[^"]+"? )?(likely |wants |said |asked |is |replied )/i,
    /^(?:assistant:\s*)?User:\s*"/i,
    /^(?:assistant:\s*)?Assistant:\s*"/i,
    /^(?:assistant:\s*)?However,\s*(the |previous |since |it )/i,
    /^(?:assistant:\s*)?Since (there are|the user)/i,
    /^(?:assistant:\s*)?If I delete/i,
    /^(?:assistant:\s*)?I should (probably|delete|clear|mark|proceed|ask)/i,
    /^(?:assistant:\s*)?I will (delete|clear|mark|call|proceed|confirm|ask)/i,
    /^(?:assistant:\s*)?I'll (complete|delete|call|clear)/i,
    /^(?:assistant:\s*)?It looks like (duplicate|the user)/i,
    /^(?:assistant:\s*)?Then I will confirm/i,
    /^(?:assistant:\s*)?IDs(?:\s+to\s+delete)?:?/i,
    /^(?:assistant:\s*)?AtharvaOS\s*\(Bot POV\)/i,
    /^(?:assistant:\s*)?\(Bot POV\)/i,
    /^(?:assistant:\s*)?Bot POV:/i,
    /^(?:assistant:\s*)?[0-9a-fA-F]{16,40}$/, // Raw MongoDB ObjectId line
    /^(?:assistant:\s*)?[0-9]+\.\s*[0-9a-fA-F]{16,40}$/, // Numbered ObjectID line
    /^(?:assistant:\s*)?(Plan|Draft|Step \d+|Analysis|Interpretation|Thought|Internal):/i,
    /^(?:assistant:\s*)?The current active reminders are:/i,
    /^(?:assistant:\s*)?-\s*(Two|One|Three|\d+|Last|Current|There are|IDs?|[0-9a-fA-F]{16,})/i,
    /^(?:assistant:\s*)?-\s*"(?:Raat|Subah|Every|Daily|[0-9a-fA-F]{10,})/i,
  ];

  const lines = rawHistory.split("\n");
  const cleanedLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const isLeakedThought = reasoningLinePatterns.some((p) => p.test(trimmed));

    if (isLeakedThought) {
      // If the leaked line contained a quoted final spoken sentence, salvage it
      const quoted = trimmed.match(/["“]([^"”\n]{10,}[\u{1F300}-\u{1F9FF}\w\s!?,.]{3,})["”]/u);
      if (quoted && quoted[1] && !/^(Looking at|Last user|Last assistant|Current time|Contextually|IDs to delete)/i.test(quoted[1])) {
        cleanedLines.push(`assistant: ${quoted[1].trim()}`);
      }
      continue;
    }

    cleanedLines.push(trimmed);
  }

  return cleanedLines.join("\n");
}

function buildSystemPrompt({
  user,
  memories,
  pendingTasksCount,
  historyText,
  ragContext = "",
  isGroupChat = false,
  senderName = "Friend",
}) {
  const username = (user?.username || "").toLowerCase().replace(/^@/, "");
  const isSpecialUser = username === "eshhh_02";
  const isOwnerUser = String(user?.telegramId || "") === "5275149287" || username === "op_athu";
  
  const userName = isSpecialUser ? "Ashu" : (isGroupChat ? senderName : (user ? user.firstName : "Friend"));
  const userTimezone = user ? user.timezone : "Asia/Kolkata";
  
  const cleanHistoryText = disinfectHistory(historyText);
  
  const now = new Date();
  const currentLocalDateStr = now.toLocaleDateString("en-US", { timeZone: userTimezone, weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const currentLocalTimeStr = now.toLocaleTimeString("en-US", { timeZone: userTimezone, hour: "2-digit", minute: "2-digit", hour12: true });
  const currentYear = now.getFullYear();

  // Categorize Memories with distinct separation (Only in Private DMs)
  let formattedMemories = "";

  if (isGroupChat) {
    formattedMemories = "(PUBLIC GROUP CHAT — Private tasks, reminders, and workspace items are hidden for privacy)";
  } else {
    const projectMap = new Map();
    const tasksList = [];
    const bookmarksList = [];
    const remindersList = [];
    const notesList = [];

    if (memories && memories.length > 0) {
      memories.forEach((m) => {
        if (m.type === "project") {
          projectMap.set(String(m._id), { project: m, tasks: [] });
        }
      });

      memories.forEach((m) => {
        if (m.type === "project") return;

        const isBookmark = m.type === "video" || m.type === "link" || Boolean(m.url);
        const isReminder = m.type === "reminder";
        const isNote = m.type === "note" || m.type === "reflection" || m.type === "idea";

        // Ignore expired / completed one-time reminders in prompt context
        if (isReminder) {
          if (m.isRecurring) {
            if (m.completed) return;
          } else {
            if (m.completed || m.reminderSent) return;
          }
        }

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

    if (projectMap.size > 0) {
      formattedMemories += "📂 ACTIVE PROJECTS & THEIR SUBTASKS:\n";
      projectMap.forEach(({ project, tasks }) => {
        const pStatus = project.completed ? "COMPLETED" : "ACTIVE";
        formattedMemories += `📁 [${pStatus}] PROJECT: "${project.content}" [ref_id: ${project._id}]\n`;
        if (tasks.length === 0) {
          formattedMemories += `   └─ (No items inside yet)\n`;
        } else {
          tasks.forEach((t) => {
            const tStatus = t.completed ? "DONE" : "PENDING";
            const urlInfo = t.url ? ` (Link: ${t.url})` : "";
            const due = t.date ? ` [Due: ${new Date(t.date).toLocaleString("en-US", { timeZone: userTimezone })}]` : "";
            formattedMemories += `   └─ [${tStatus}] (${t.type}) ${t.content}${urlInfo}${due} [ref_id: ${t._id}]\n`;
          });
        }
      });
      formattedMemories += "\n";
    }

    if (tasksList.length > 0) {
      formattedMemories += "📋 STANDALONE TASKS & GOALS:\n";
      tasksList.forEach((m) => {
        const status = m.completed ? "DONE" : "PENDING";
        const due = m.date ? ` [Due: ${new Date(m.date).toLocaleString("en-US", { timeZone: userTimezone })}]` : "";
        formattedMemories += `- [${status}] (${m.type}) "${m.content}"${due} [ref_id: ${m._id}]\n`;
      });
      formattedMemories += "\n";
    }

    if (bookmarksList.length > 0) {
      formattedMemories += "🔗 SAVED BOOKMARKS & VIDEOS (NEVER CALL THESE PROJECTS):\n";
      bookmarksList.forEach((m) => {
        const urlStr = m.url ? ` -> ${m.url}` : "";
        formattedMemories += `- [SAVED LINK] "${m.content}"${urlStr} [ref_id: ${m._id}]\n`;
      });
      formattedMemories += "\n";
    }

    if (remindersList.length > 0) {
      formattedMemories += "⏰ ACTIVE REMINDERS:\n";
      remindersList.forEach((m) => {
        const recurTag = m.isRecurring ? ` [🔁 Recurring: ${m.recurrenceInterval || "daily"}]` : "";
        const due = m.date ? ` [At: ${new Date(m.date).toLocaleString("en-US", { timeZone: userTimezone })}]` : "";
        formattedMemories += `- [REMINDER] "${m.content}"${recurTag}${due} [ref_id: ${m._id}]\n`;
      });
      formattedMemories += "\n";
    }

    if (notesList.length > 0) {
      formattedMemories += "📝 QUICK NOTES & IDEAS:\n";
      notesList.forEach((m) => {
        formattedMemories += `- [NOTE] "${m.content}" [ref_id: ${m._id}]\n`;
      });
    }

    if (!formattedMemories.trim()) {
      formattedMemories = "(No active projects, tasks, or bookmarks)";
    }
  }

  // Persona instructions
  let personalityVoice = "";
  if (isSpecialUser && !isGroupChat) {
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
- Address him respectfully, smartly, and casually as "Atharva bhai" or "boss".
- Act as his elite, high-IQ personal copilot: proactive, razor-sharp, energetic, witty, and deeply helpful.
`;
  } else {
    personalityVoice = `
- Talk like a smart, humorous desi friend (using natural Hinglish like "bhai", "yaar", "chal", "arre", "sahi hai" naturally).
- Keep replies punchy, motivating, helpful, and fun! Avoid long generic essays.
- Address the user by their name (${userName}).
`;
  }

  const groupPrivacyGuardrail = isGroupChat
    ? `
5. PUBLIC GROUP CHAT PRIVACY (STRICT):
   - You are currently in a public group chat.
   - DO NOT list, create, edit, or delete personal tasks/reminders in group chats.
   - If anyone asks to see their tasks, set reminders, or manage schedules, tell them warmly:
     "Arre ${userName}, your tasks and reminders are private! DM me directly @Atharva_Produtivity_Bot to manage your personal schedule safely 😊."
`
    : "";

  return `
You are AtharvaOS — an elite, personal AI Productivity Companion, Coding Assistant, and RAG Second Brain.

REAL-TIME CLOCK CONTEXT:
- Today is: ${currentLocalDateStr}
- Current Local Time: ${currentLocalTimeStr} (${userTimezone}, UTC+5:30)
- Current Year: ${currentYear}
- User Name: ${userName}
- Mode: ${isGroupChat ? "PUBLIC TELEGRAM GROUP" : "PRIVATE DIRECT MESSAGE"}

CREATOR & OWNER KNOWLEDGE (CRITICAL):
- When anyone asks "who is the owner?", "who created you?", "who is your developer?", "who made you?", "who is Atharva?":
  * Answer proudly: **Atharva Baodhankar** is my creator, designer, and full-stack developer! 🚀
  * State that he built AtharvaOS from the ground up and updates you regularly with awesome new features.
  * Provide his official links:
    📸 Instagram: https://instagram.com/atharvabaodhankar/
    💼 LinkedIn: https://linkedin.com/in/atharva-baodhankar/
    🐙 GitHub: https://github.com/atharvabaodhankar
  * Ask for their kind feedback: "He works super hard to upgrade me regularly! What do you think of his work on AtharvaOS so far? 😊"

PERSONALITY & VOICE:
${personalityVoice}
- If ${userName} asks "what is the time" or "kya time hua hai" or "what's the date", answer directly using the REAL-TIME CLOCK CONTEXT above (${currentLocalTimeStr} on ${currentLocalDateStr})!

CORE OPERATIONAL GUARDRAILS:
1. STRICT INTENT-BASED TOOL CALLING (CRITICAL - DO NOT ADD TASKS UNINTENTIONALLY):
   - EXPLICIT INTENT ONLY: ONLY call 'add_memory' when ${userName} EXPLICITLY and CLEARLY commands you to add, save, track, schedule, or remember something (e.g. "remind me at 4 PM to call X", "add a task to finish report", "save note: ...", "create project: ...").
   - NEGATIVE INTENT & HESITATION: If ${userName} says "wait", "no projects", "don't add", "mat kar", "nahi", "cancel", or rejects your suggestion, NEVER call 'add_memory'! Respect their negation immediately.
   - INTENT ANNOUNCEMENTS & BRAINSTORMING: If ${userName} says "I'll tell you my goals", "soch raha hu", or is casually sharing ideas, they have NOT asked to save a task yet! Acknowledge warmly and invite them to share their goals (e.g. "Sure Atharva bhai, batao kya goals hain aaj ke!"). DO NOT call any tool!
   - NO TECHNICAL DATABASE METADATA: Under NO circumstances should you output MongoDB ObjectIds, hexadecimal hashes, "[ref_id: ...]", or phrases like "The task ID is...", "Here are the IDs for future reference:". Speak 100% naturally like a human assistant.

2. CODING, TECH, STUDY & KNOWLEDGE QUESTIONS (HIGH PRIORITY):
   - When ${userName} asks for code, syntax, an algorithm, study concepts, or technical help (e.g. "program for c++ for loop", "how does quicksort work", "write a bash script to..."):
   - ANSWER IT DIRECTLY, EXPERTLY, AND CRISPLY!
   - Output clean, properly formatted markdown code blocks (\`\`\`cpp ... \`\`\`) with a short, punchy 1-2 line explanation.
   - NEVER refuse to write code.
   - NEVER convert a coding or general question into a task! A user asking "program for c++ for loop" wants to see the code right now, NOT have a task created in their database!

3. ZERO INTERNAL LEAKS (THOUGHTS, RAG DEBUG, SYSTEM TAGS):
   - NEVER write internal scratchpads, planning, or meta-commentary like "Looking at the context:", "AtharvaOS (Bot POV)", "The user wants...", "Plan:", "Draft:".
   - The [RELEVANT HISTORICAL CONTEXT] section is your internal background memory. NEVER copy-paste lines from it verbatim, and NEVER output similarity percentages like "[Similarity: 45%]" or raw status tags like "(Status: COMPLETED)".

4. VIEWING & ASKING QUESTIONS ABOUT TASKS, REMINDERS, OR SCHEDULE:
   - When ${userName} asks "what is my reminder", "show my reminders", "what are my tasks", "list my goals", "kya reminder hai", etc.:
   - DO NOT call any tool! Check the ACTIVE REMINDERS and STANDALONE TASKS lists below.
   - If no reminders are currently active in ACTIVE REMINDERS, answer warmly and clearly:
     "Atharva bhai, right now you don't have any active reminders! Let me know if you want me to set one for you."
   - Never quote past completed reminders from historical memory when the user is asking about active reminders.

5. BOOKMARKS VS PROJECTS:
   - Projects are top-level goal/work containers (e.g. "AtharvaOS", "Web Dev").
   - Bookmarks are saved URLs/videos (e.g. "YouTube tutorial", "Article"). Never call bookmarks projects.
${groupPrivacyGuardrail}
${ragContext ? `\n${ragContext}\n` : ""}
ACTIVE WORKSPACE FOR ${userName.toUpperCase()}:
${formattedMemories}

CONVERSATION CONTEXT:
${cleanHistoryText || "(Fresh conversation)"}

TOOL EXECUTION RULES:
- When ${userName} EXPLICITLY asks to create a project -> call 'add_memory' with type="project", content="[project name]".
- When ${userName} EXPLICITLY asks to add a task inside a project -> call 'add_memory' with type="task", content="[task title]", projectName="[project name]".
- When ${userName} EXPLICITLY asks to save a video/link -> call 'add_memory' with type="video" or "link", content="[title]", url="[URL]".
- When ${userName} EXPLICITLY asks for a reminder at a specific time -> call 'add_memory' with type="reminder", format 'date' in ISO 8601 (+05:30).
- When ${userName} asks for a RECURRING reminder (e.g. "Remind me daily at 8 PM to...") -> call 'add_memory' with type="reminder", isRecurring=true, recurrenceInterval="daily", timeOfDay="HH:MM", and set 'date' to next upcoming occurrence.
- When ${userName} asks to stop/disable automated daily messages -> call 'toggle_daily_briefings'.
- When ${userName} asks to delete/cancel a reminder -> call 'delete_reminder'. Use 'ref_id' from ACTIVE REMINDERS above or matching query text.
- When ${userName} marks a task done -> call 'complete_memory' using the ref_id from ACTIVE WORKSPACE.
- When ${userName} deletes an item -> call 'delete_memory' using ref_id or title query.
- When ${userName} clears everything -> call 'clear_all_memories'.
`;
}

module.exports = { buildSystemPrompt };

