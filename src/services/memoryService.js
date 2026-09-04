const Memory = require("../models/Memory");

async function addMemory({ chatId, type, content, date, priority = "medium", tags = [] }) {
  return await Memory.create({
    chatId,
    type,
    content,
    date: date ? new Date(date) : null,
    priority,
    tags,
  });
}

async function getPendingTasks(chatId) {
  return await Memory.find({
    chatId,
    type: { $in: ["task", "assignment", "project", "exam"] },
    completed: false,
  }).sort({ date: 1, createdAt: -1 });
}

const mongoose = require("mongoose");

async function getReminders(chatId) {
  return await Memory.find({
    chatId,
    type: "reminder",
    completed: false,
    $or: [
      { isRecurring: true },
      { reminderSent: { $ne: true } },
    ],
  }).sort({ date: 1, createdAt: -1 });
}

async function getGoals(chatId) {
  return await Memory.find({
    chatId,
    type: "goal",
    completed: false,
  }).sort({ date: 1 });
}

async function getRecentReflections(chatId, days = 7) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return await Memory.find({
    chatId,
    type: "reflection",
    createdAt: { $gte: cutoff },
  }).sort({ createdAt: -1 });
}

async function getTodaySummary(chatId) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const todayDue = await Memory.find({
    chatId,
    date: { $gte: startOfDay, $lt: endOfDay },
    type: { $in: ["task", "assignment", "project", "exam"] },
    completed: false,
  });

  const upcomingTasks = await Memory.find({
    chatId,
    type: { $in: ["task", "assignment", "project", "exam"] },
    completed: false,
  })
    .sort({ date: 1 })
    .limit(5);

  return {
    todayDue,
    upcomingTasks,
  };
}

async function completeMemory(chatId, id) {
  return await Memory.findOneAndUpdate(
    { _id: id, chatId },
    { completed: true },
    { new: true }
  );
}

async function deleteMemory(chatId, idOrQuery) {
  if (!idOrQuery) return null;
  const str = String(idOrQuery).trim();
  if (mongoose.Types.ObjectId.isValid(str)) {
    const byId = await Memory.findOneAndDelete({ _id: str, chatId });
    if (byId) return byId;
  }
  const escaped = str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return await Memory.findOneAndDelete({
    chatId,
    content: new RegExp(escaped, "i"),
  });
}

async function deleteReminders(chatId, { id, query, all = false } = {}) {
  if (all) {
    const res = await Memory.deleteMany({ chatId, type: "reminder" });
    return { count: res.deletedCount, all: true };
  }
  if (id && mongoose.Types.ObjectId.isValid(id)) {
    const deleted = await Memory.findOneAndDelete({ _id: id, chatId, type: "reminder" });
    return { deleted, count: deleted ? 1 : 0 };
  }
  const searchStr = (query || id || "").trim();
  if (searchStr) {
    const escaped = searchStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const deleted = await Memory.findOneAndDelete({
      chatId,
      type: "reminder",
      content: new RegExp(escaped, "i"),
    });
    return { deleted, count: deleted ? 1 : 0 };
  }
  const active = await getReminders(chatId);
  if (active.length === 1) {
    const deleted = await Memory.findByIdAndDelete(active[0]._id);
    return { deleted, count: 1 };
  }
  return { activeReminders: active, count: 0 };
}

async function clearAllMemories(chatId) {
  return await Memory.deleteMany({ chatId });
}

module.exports = {
  addMemory,
  getPendingTasks,
  getReminders,
  getGoals,
  getRecentReflections,
  getTodaySummary,
  completeMemory,
  deleteMemory,
  deleteReminders,
  clearAllMemories,
};
