const mongoose = require("mongoose");

const commision = new mongoose.Schema(
  {
    vat: {
      type: Number,
      required: true,
      default: 0,
    },
    commission: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);
module.exports = mongoose.model("commision", commision);
