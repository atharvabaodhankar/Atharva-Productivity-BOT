const mongoose = require("mongoose");

const groupConfigSchema = new mongoose.Schema(
  {
    chatId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      default: "",
    },
    enabled: {
      type: Boolean,
      default: false, // Default is OFF when added to a group until Owner turns it ON with /on
    },
    updatedBy: {
      type: Number,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("GroupConfig", groupConfigSchema);
