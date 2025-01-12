const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

//Define Schema
const adminSchema = new mongoose.Schema({
  adminId: {
    type: String,
    default: "",
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    trim: true,
  },
  address: {
    type: String,
    default: "",
  },
  mobile: {
    type: String,
    default: "",
  },
  tc: {
    type: Boolean,
    default: true,
    required: true,
    trim: true,
  },
  roleType: {
    type: Number,
    default: 2,
  },
  status: {
    type: Number,
    default: 1,
  },
  token: String,
});

adminSchema.methods.generateToken = async function () {
  const secret = process.env.JWT_SECRET_KEY; // // Replace with your own secret key

  const token = jwt.sign(
    {
      _id: this._id,
    },
    secret,
    {
      expiresIn: "24h",
    }
  );
  return token;
};

module.exports = mongoose.model("admins", adminSchema);
