const mongoose = require("mongoose");

const memorySchema = new mongoose.Schema({
  type: String,
  content: String,
  date: Date,
  chatId: Number, // Store which user this memory belongs to
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Memory", memorySchema);