const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema(
  {
    chatId: {
      type: Number,
      required: true,
      index: true,
    },
    userName: {
      type: String,
      default: "Anonymous",
    },
    username: {
      type: String,
      default: "",
    },
    type: {
      type: String,
      enum: ["EASTER_EGG", "NSFW_TRIGGER", "SECRET_COMMAND"],
      default: "EASTER_EGG",
    },
    trigger: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

alertSchema.index({ createdAt: -1 });

module.exports = mongoose.models.Alert || mongoose.model("Alert", alertSchema);
