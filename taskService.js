const Memory = require("./memoryModel");

async function getTasks() {
  const tasks = await Memory.find({
    type: { $in: ["task", "assignment", "exam", "project"] }
  }).sort({ date: 1 });

  return tasks;
}

module.exports = { getTasks };