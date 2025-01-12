const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "categories",
    },
    subCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "subCategories",
    },
    images: [
      {
        productImage: {
          type: String,
          required: true,
        },
      },
    ],
    quantity: {
      type: Number,
      required: false,
    },
    unit: {
      type: String,
      required: false,
    },
    price: {
      type: Number,
      required: false,
      default: null,
    },
    rank: {
      type: Number,
      default: 0,
    },
    featureBidAmt: {
      type: Number,
      default: 0,
    },
    description: {
      type: String,
      required: false,
    },
    mobile: {
      type: String,
      required: false,
    },
    countryCode: {
      type: String,
      required: false,
    },
    productLocation: {
      type: String,
      required: false,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        default: [77.3799949, 28.623106],
      },
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    startTime: {
      type: String,
      default: null,
    },
    endTime: {
      type: String,
      default: null,
    },
    orderTimer: {
      type: Date,
      default: null,
    },
    secondOrderTimer: {
      type: Date,
      default: null,
    },
    scheduleId: {
      type: String,
      default: "",
    },
    orderScheduleId: {
      type: String,
      default: "",
    },
    secondOrderScheduleId: {
      type: String,
      default: "",
    },
    status: {
      type: Boolean,
      default: true, // Default value is true (Active)
    },
    isFeatured: {
      type: Boolean,
      default: false, // Default value is false (InActive)
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    lastNotifications: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);
ProductSchema.index({ location: "2dsphere" });
// Define a virtual property 'imageUrl' that concatenates the base URL with the image field
ProductSchema.virtual("imageUrl").get(function () {
  if (this.images && this.images.length > 0) {
    // If the image array is not empty
    return this.images.map((image) => process.env.AWS_URL + image.productImage);
  }
  return [];
});
// Ensure virtuals are included in JSON output
ProductSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    // Remove the "id" property from the JSON output
    //   delete ret.image;
    delete ret.id;
  },
});

module.exports = mongoose.model("products", ProductSchema);
