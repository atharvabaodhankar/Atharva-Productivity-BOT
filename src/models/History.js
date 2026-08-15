const mongoose = require("mongoose");

const historySchema = new mongoose.Schema(
  {
    chatId: {
      type: Number,
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    telegramMessageId: {
      type: Number,
      default: null,
    },
    hasSpoiler: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

historySchema.index({ chatId: 1, createdAt: -1 });

module.exports = mongoose.models.History || mongoose.model("History", historySchema);
