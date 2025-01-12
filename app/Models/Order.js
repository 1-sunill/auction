const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
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
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "categories" },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "products", // assuming you have a Product model
    },

    orderId: {
      type: String,
      unique: true, // Ensures orderId is unique
      default: null,
    },
    invoiceNo: {
      type: String,
      unique: true, // Ensures orderId is unique
      default: null,
    },
    highestBidPrice: {
      type: Number, // Assuming amount is a numerical value
      required: true, // Assuming amount is required
    },
    amount: {
      type: Number, // Assuming amount is a numerical value
      required: true, // Assuming amount is required
    },
    boxNumber: {
      type: Number,
      default: null,
    },
    boxLength: {
      type: String,
      default: null,
    },
    boxHeight: {
      type: String,
      default: null,
    },
    boxWidth: {
      type: String,
      default: null,
    },
    vatAmount: {
      type: Number,
      default: 0,
    },
    orderStatus: {
      type: String,
      enum: ["Confirmed", "Packed", "Delivered", "Cancelled", "Returned"],
      default: "Confirmed",
    },
    sellerOrderStatus: {
      type: String,
      enum: ["Received", "Packed", "Delivered", "Cancelled", "Returned"],
      default: "Received",
    },
    returnOrderStatus: {
      type: String,
      enum: [
        "pending",
        "returnRequest",
        "returnAccept",
        "returnReject",
        "Pickup",
        "Picked",
        "Refund",
      ],
      default: "pending",
    },
    sellerReturnOrderStatus: {
      type: String,
      enum: ["pending", "returnReceived", "orderPicked", "packageReceived"],
      default: "pending",
    },
    adminCommission: {
      type: String,
      default: null,
    },
    sellerCommission: {
      type: String,
      default: null,
    },
    bidderRefund: {
      type: String,
      default: null,
    },
    rejectReturnReason: {
      type: String,
      default: null,
    },
    cancelReason: {
      type: String,
      default: null,
    },
    returnReason: {
      type: String,
      default: null,
    },
    shippingMethod: {
      type: String,
      default: "myself",
    },
    qrCode: {
      type: String,
      default: "",
    },
    orderPlaced: {
      type: Boolean,
      default: false, // Default value is true (inactive)
    },
    packedAt: {
      type: Date,
      default: null,
    },
    cancelAt: {
      type: Date,
      default: null,
    },
    deliveryAt: {
      type: Date,
      default: null,
    },
    returnAt: {
      type: Date,
      default: null,
    },
    returnAcceptAt: {
      type: Date,
      default: null,
    },
    returnOrderPickedUp: {
      type: Date,
      default: null,
    },
    returnOrderPickedAt: {
      type: Date,
      default: null,
    },
    selfPickUpTimer: {
      type: Date,
      default: null,
    },
    packTimer: {
      type: Date,
      default: null,
    },
    returnTimer: {
      type: Date,
      default: null,
    },
    lastNotifications: {
      type: Date,
      default: null,
    },
    isAssign: {
      type: Number,
      default: 0,
      comment: "1=>Second highest,2=>Reject by bidder",
    },
    secondHighestUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to generate userName before saving the User
// orderSchema.pre('save', async function (next) {
//     if (!this.orderId) {
//         const currentYear = new Date().getFullYear().toString().slice(-2); // Get the last 2 digits of the current year
//         const randomSuffix = Math.floor(10000 + Math.random() * 90000); // Random 4-digit number
//         // Concatenate orderId with year prefix and random suffix
//         this.orderId = `${currentYear}${randomSuffix}`;
//     }
//     next();
// });

module.exports = mongoose.model("orders", orderSchema);
