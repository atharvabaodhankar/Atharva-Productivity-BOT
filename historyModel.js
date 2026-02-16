const mongoose = require("mongoose");

const historySchema = new mongoose.Schema({
  chatId: { type: Number, required: true },
  role: { type: String, enum: ["user", "assistant"], required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

// Index for faster lookups by chatId and sorting by timestamp
historySchema.index({ chatId: 1, createdAt: -1 });

module.exports = mongoose.model("History", historySchema);
