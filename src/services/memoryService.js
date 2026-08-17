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

async function getReminders(chatId) {
  const now = new Date();
  return await Memory.find({
    chatId,
    type: "reminder",
    completed: false,
    reminderSent: { $ne: true },
    date: { $gte: now },
  }).sort({ date: 1 });
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

async function deleteMemory(chatId, id) {
  return await Memory.findOneAndDelete({ _id: id, chatId });
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
  clearAllMemories,
};
