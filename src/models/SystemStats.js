const mongoose = require("mongoose");

const systemStatsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "global_stats", unique: true },
    totalInputTokens: { type: Number, default: 0 },
    totalOutputTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    totalAiRequests: { type: Number, default: 0 },
    modelBreakdown: {
      type: Map,
      of: Number,
      default: {},
    },
    voiceNotesGenerated: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.SystemStats ||
  mongoose.model("SystemStats", systemStatsSchema);
