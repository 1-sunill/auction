const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
    },
    title: {
      type: String,
      default: null,
    },
    message: {
      type: String,
      default: null,
    },
    // type: {
    //   type: Number,
    //   required: true,
    // },
    secondHighestmsg: {
      type: Number,
      Comment: "1=>yes,2=>no",
      default: 2,
    },
    bidId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "bids",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Notification", notificationSchema);
