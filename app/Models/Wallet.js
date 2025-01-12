const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      default: "",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
    },
    transactionType: {
      type: String,
      enum: ["credit", "debit"], // Enum values for transactionType
    },
    subCategoryName: {
      type: String,
      default: "",
    },
    categoryName: {
      type: String,
      default: "",
    },
    transactionSource: {
      type: String,
      default: "",
    },
    amount: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Wallet", walletSchema);
