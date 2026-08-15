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
    memeRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MemeRequest",
      default: null,
    },
    memeUrl: {
      type: String,
      default: "",
    },
    mediaType: {
      type: String,
      default: "image",
    },
    memeStatus: {
      type: String,
      enum: ["NONE", "PENDING", "APPROVED", "REJECTED"],
      default: "NONE",
    },
  },
  {
    timestamps: true,
  }
);

alertSchema.index({ createdAt: -1 });

module.exports = mongoose.models.Alert || mongoose.model("Alert", alertSchema);
