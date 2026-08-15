function parseUserDate(dateInput, userTimezone = "Asia/Kolkata") {
  if (!dateInput) return null;

  try {
    const raw = String(dateInput).trim();

    // If string already has a timezone indicator (Z or +HH:MM / -HH:MM)
    if (raw.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(raw)) {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) return d;
    }

    // If format is YYYY-MM-DDTHH:mm:ss without timezone, append +05:30 for Asia/Kolkata
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?/.test(raw)) {
      const offset = userTimezone === "Asia/Kolkata" ? "+05:30" : "Z";
      const normalized = raw.length === 16 ? raw + ":00" + offset : raw + offset;
      const d = new Date(normalized);
      if (!isNaN(d.getTime())) return d;
    }

    const fallback = new Date(raw);
    return isNaN(fallback.getTime()) ? null : fallback;
  } catch (err) {
    console.error("Date parsing error:", err);
    return null;
  }
}

module.exports = { parseUserDate };
