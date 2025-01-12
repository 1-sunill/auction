const mongoose = require("mongoose");

const supportSchema = new mongoose.Schema(
  {
    roomId: {
      type: Number,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    ticketId: {
      type: String,
      default: null,
    },
    supportType: {
      type: String,
      enum: ["orderSupport", "helpSupport"],
    },
    title: {
      type: String,
      default: null,
    },
    message: {
      type: String,
      default: null,
    },
    status: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);
module.exports = mongoose.model("Support", supportSchema);
