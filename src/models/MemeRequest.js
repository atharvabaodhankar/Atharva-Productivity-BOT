const mongoose = require("mongoose");

const memeRequestSchema = new mongoose.Schema(
  {
    chatId: {
      type: Number,
      required: true,
    },
    userName: {
      type: String,
      default: "Friend",
    },
    username: {
      type: String,
      default: "",
    },
    memeTitle: {
      type: String,
      default: "NSFW Meme",
    },
    memeUrl: {
      type: String,
      required: true,
    },
    mediaType: {
      type: String,
      default: "image",
    },
    subreddit: {
      type: String,
      default: "NSFWMemes",
    },
    permalink: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.MemeRequest ||
  mongoose.model("MemeRequest", memeRequestSchema);
