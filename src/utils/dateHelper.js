/**
 * Robust date parser supporting ISO strings, natural language, relative offsets, and Hinglish.
 * E.g.: "in 15 minutes", "2 ghante baad", "tomorrow at 8:30 am", "tonight at 9 pm", "20:00", "2026-10-26T20:00:00+05:30"
 */

function parseUserDate(dateInput, userTimezone = "Asia/Kolkata") {
  if (!dateInput) return null;

  try {
    const raw = String(dateInput).trim();
    const lower = raw.toLowerCase().trim();
    const now = new Date();

    // 1. ISO-8601 with timezone indicator (Z or +HH:MM / -HH:MM)
    if (raw.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(raw)) {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) return d;
    }

    // 2. ISO format without timezone indicator -> append local offset
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      const offset = userTimezone === "Asia/Kolkata" ? "+05:30" : "Z";
      const normalized = raw.length === 16 ? raw + ":00" + offset : (raw.length === 10 ? raw + "T00:00:00" + offset : raw + offset);
      const d = new Date(normalized);
      if (!isNaN(d.getTime())) return d;
    }

    // 3. Relative offset in minutes / hours / days (English & Hinglish)
    if (lower === "aadhe ghante baad" || lower === "half an hour" || lower === "in half an hour") {
      return new Date(now.getTime() + 30 * 60 * 1000);
    }

    const relMatch = lower.match(/(?:in\s+)?(\d+)\s*(mins?|minutes?|hrs?|hours?|days?|ghante?|min|din)\s*(?:baad|ke baad|later)?/i);
    if (relMatch) {
      const amount = parseInt(relMatch[1], 10);
      const unit = relMatch[2].toLowerCase();

      if (unit.startsWith("m") || unit === "min") {
        return new Date(now.getTime() + amount * 60 * 1000);
      } else if (unit.startsWith("h") || unit.startsWith("gh")) {
        return new Date(now.getTime() + amount * 60 * 60 * 1000);
      } else if (unit.startsWith("d")) {
        return new Date(now.getTime() + amount * 24 * 60 * 60 * 1000);
      }
    }

    // 4. Day indicators: "tomorrow" / "kal", "today" / "aaj", "tonight" / "aaj raat"
    const isTomorrow = /\b(tomorrow|kal|next day)\b/i.test(lower);
    const isTonight = /\b(tonight|aaj raat|raat ko)\b/i.test(lower);
    const isToday = /\b(today|aaj)\b/i.test(lower);

    // 5. Extract time components (e.g. "8:30 pm", "20:00", "7 pm", "8 baje")
    const timeMatch = lower.match(/(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|baje)?/i);
    if (timeMatch && (timeMatch[3] || timeMatch[2] || isTomorrow || isTonight || isToday || lower.includes(":"))) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const meridiem = (timeMatch[3] || "").toLowerCase();

      if (meridiem === "pm" && hours < 12) hours += 12;
      if (meridiem === "am" && hours === 12) hours = 0;
      if (isTonight && hours < 12 && !meridiem) hours += 12;

      const tzFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: userTimezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });

      const parts = tzFormatter.formatToParts(now);
      const partMap = {};
      parts.forEach((p) => { partMap[p.type] = p.value; });

      let targetYear = parseInt(partMap.year, 10);
      let targetMonth = parseInt(partMap.month, 10) - 1;
      let targetDay = parseInt(partMap.day, 10);

      if (isTomorrow) {
        targetDay += 1;
      }

      const offset = userTimezone === "Asia/Kolkata" ? "+05:30" : "Z";
      const pad = (n) => String(n).padStart(2, "0");
      const isoStr = `${targetYear}-${pad(targetMonth + 1)}-${pad(targetDay)}T${pad(hours)}:${pad(minutes)}:00${offset}`;
      let targetDate = new Date(isoStr);

      if (!isTomorrow && !isToday && targetDate <= now) {
        targetDay += 1;
        const nextIso = `${targetYear}-${pad(targetMonth + 1)}-${pad(targetDay)}T${pad(hours)}:${pad(minutes)}:00${offset}`;
        targetDate = new Date(nextIso);
      }

      if (!isNaN(targetDate.getTime())) {
        return targetDate;
      }
    }

    // 6. General fallback
    const fallback = new Date(raw);
    return isNaN(fallback.getTime()) ? null : fallback;
  } catch (err) {
    console.error("Date parsing error:", err);
    return null;
  }
}

module.exports = { parseUserDate };
