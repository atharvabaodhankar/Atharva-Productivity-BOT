const mongoose = require("mongoose");

const memorySchema = new mongoose.Schema(
  {
    chatId: {
      type: Number,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "task",
        "assignment",
        "exam",
        "project",
        "goal",
        "idea",
        "reminder",
        "note",
        "reflection",
      ],
      required: true,
      default: "task",
    },
    content: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      default: null,
    },
    completed: {
      type: Boolean,
      default: false,
      index: true,
    },
    reminderSent: {
      type: Boolean,
      default: false,
      index: true,
    },
    priority: {
      type: String,
      enum: ["high", "medium", "low"],
      default: "medium",
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  {
    timestamps: true,
  }
);

memorySchema.index({ chatId: 1, completed: 1, date: 1 });

module.exports = mongoose.model("Memory", memorySchema);
