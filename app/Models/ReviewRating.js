const mongoose = require("mongoose");

const reviewRatingsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "orders",
    },
    rating: {
      type: Number, // Assuming rating is a numerical value
      min: 1, // Assuming rating should be at least 1
      max: 5, // Assuming rating should not exceed 5
      default: 0,
    },
    review: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("reviewRatings", reviewRatingsSchema);
