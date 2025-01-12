const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    roomId: {
      type: Number,
      default: function () {
        // Combine timestamp with a random number to ensure uniqueness
        return Date.now() + Math.floor(Math.random() * 1000);
      },
      unique: true,
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
    lastMessage: {
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
      enum: [1, 2, 3, 4], //1=>text,2=>image,3=>document,4=>video
      default: 1,
    },
    isNormalChat: {
      type: Boolean,
      default: 1, //1=>normal chat ,0=>help & support
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
module.exports = mongoose.model("chats", chatSchema);
