const mongoose = require("mongoose");

const memorySchema = new mongoose.Schema({
  type: String,
  content: String,
  date: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Memory", memorySchema);