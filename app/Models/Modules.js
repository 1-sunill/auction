const mongoose = require("mongoose");

const modulesSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: "",
    },
    order: { type: Number, default: "" },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Modules", modulesSchema);
