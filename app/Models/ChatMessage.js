const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema(
  {
    roomId: {
      type: Number,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    receiverId: {
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
    message: {
      type: String,
      default: null,
    },
    senderType: {
      type: String,
      enum: ["user", "admin"],
    },
    receiverType: {
      type: String,
      enum: ["user", "admin"],
    },
    messageType: {
      type: Number,
      enum: [1, 2], //1=>text,2=>image
      default: 1,
    },
    images: [],
    clearBy: [],
    seenBy: [],
    deletedBy: [],
    status: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);
module.exports = mongoose.model("chatmessages", chatMessageSchema);
