const mongoose = require("mongoose");

const bidSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
    },
    subCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "subCategories",
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "products", // assuming you have a Product model
    },
    bidType: {
      type: String,
      enum: ["featured", "purchase"],
      default: "purchase",
    },
    amount: {
      type: Number, // Assuming amount is a numerical value
      required: true, // Assuming amount is required
    },
    highestBidAmount: {
      type: Number, // Assuming amount is a numerical value
      default: 0, // Assuming amount is required
    },
    secondHighestBidAmount: {
      type: Number, // Assuming amount is a numerical value
      default: 0, // Assuming amount is required
    },
    assignSecondHighestBidder: {
      type: Boolean,
      default: false, // Default value is true (inactive)
    },
    bidStatus: {
      type: String,
      default: "pending",
    },
    status: {
      type: String,
      enum: ["filled", "unfilled"],
      default: "filled",
    },

    biddingDate: {
      type: Date,
      default: null,
    },
    bidCreatedDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("bids", bidSchema);
