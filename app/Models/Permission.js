const mongoose = require("mongoose");

const permissionSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "admins",
    },
    moduleId: { type: mongoose.Schema.Types.ObjectId, ref: "Modules" },
    roles: {
      type: Array,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Permission", permissionSchema);
