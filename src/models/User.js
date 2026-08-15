const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    telegramId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    firstName: {
      type: String,
      default: "Friend",
    },
    lastName: {
      type: String,
      default: "",
    },
    username: {
      type: String,
      default: "",
    },
    timezone: {
      type: String,
      default: "Asia/Kolkata",
    },
    preferences: {
      personaStyle: {
        type: String,
        enum: ["desi-hype", "chill", "professional"],
        default: "desi-hype",
      },
      dailySummaryTime: {
        type: String,
        default: "08:00",
      },
      nightlyReflectionTime: {
        type: String,
        default: "22:00",
      },
      lastDailySummaryDate: {
        type: String,
        default: "",
      },
      lastNightlyReflectionDate: {
        type: String,
        default: "",
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
