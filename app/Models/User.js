const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const UserSchema = new mongoose.Schema(
  {
    userType: {
      type: Array,
      default: "bidder",
    },
    userName: {
      type: String,
      default: "",
    },
    ar_userName: {
      type: String,
      default: "",
    },
    name: {
      type: String,
      default: "",
    },
    ar_name: {
      type: String,
      default: "",
    },
    profile_image: {
      type: String,
      default: "",
    },
    mobile: {
      type: String,
      required: false,
    },
    countryCode: {
      type: String,
      required: false,
    },
    email: {
      type: String,
      default: "",
    },
    password: {
      type: String,
      default: "",
      // select: false,
    },
    tempPasswords: {
      type: [String], // Array of hashed passwords
      default: [],
    },
    nationalIdCard: {
      type: String,
      default: null,
    },
    businessName: {
      type: String,
      default: null,
    },
    address: {
      type: String,
      default: null,
    },
    ar_address: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      default: null,
    },
    categories: [
      {
        categoryId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "categories", // assuming you have a Category model
        },
      },
    ],
    taxRegistrationNumber: {
      type: String,
      default: null,
    },
    licenceNumber: {
      type: String,
      default: null,
    },
    licenceExpiry: {
      type: String,
      default: null,
    },
    deviceType: {
      type: String,
      enum: ["ios", "android"],
      default: "android",
    },
    deviceToken: {
      type: String,
      default: "",
    },
    laguageName: {
      type: String,
      enum: ["en", "ar"],
      default: "en",
    },
    location: {
      type: {
        type: String,
        default: "Point",
      },
      coordinates: {
        type: [Number],
        default: [0, 0], // [longitude, latitude]
      },
    },
    rejectedReason: {
      type: String,
      default: null,
    },
    adminVerifyStatus: {
      type: String,
      enum: ["None", "Pending", "Accepted", "Rejected"], // 0 = Pending , 1= Accept, 2 = Reject
      default: "None",
    },
    status: {
      type: Boolean,
      default: true, // Default value is true (active)
    },
    isOnline: {
      type: Boolean,
      default: false, // Default value is true (active)
      comment: "true=>online,false=>offilne",
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    token: String,
    isAttemptCount: {
      type: Number,
      default: 1,
    }, // Field to track registration attempts
    rejectedAt: {
      type: Date,
    },
    acceptedAt: {
      type: Date,
    },
    walletTotalAmount: {
      type: Number,
      default: 0,
    },
    freezedWalletAmount: {
      type: Number,
      default: 0,
    },
    availableWalletAmount: {
      type: Number,
      default: 0,
    },
    favoriteCount: {
      type: Number,
      default: 0,
    },
    totalRating: {
      type: Number,
      default: 0,
    },
    currentDeviceRandomId: {
      type: String,
      default: "",
    },
    totalUser: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Define a virtual property 'imageUrl' that concatenates the base URL with the image field
UserSchema.virtual("profileImage").get(function () {
  if (this.get("profile_image")) {
    return process.env.AWS_URL + this.get("profile_image");
  }
  return null;
});

// Define a virtual property 'nationalIdCardUrl' for the nationalIdCard image
UserSchema.virtual("nationalIdCardUrl").get(function () {
  if (this.get("nationalIdCard")) {
    return process.env.AWS_URL + this.get("nationalIdCard");
  }
  return null;
});

// Ensure virtuals are included in JSON output
UserSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    // Remove the "id" property from the JSON output
    delete ret.id;
  },
});

UserSchema.index({
  location: "2dsphere",
});

// Pre-save hook to generate userName before saving the User
UserSchema.pre("save", async function (next) {
  if (!this.userName) {
    // Generate unique username (combination of first three characters of name and a random 4-digit number)
    const randomSuffix = Math.floor(1000 + Math.random() * 9000); // Random 4-digit number
    const firstThreeChars = this.name.slice(0, 3); // First three characters of the name
    this.userName = `${firstThreeChars}${randomSuffix}`;
  }
  next();
});

UserSchema.methods.generateToken = async function () {
  const secret = process.env.JWT_SECRET_KEY; // Replace with your own secret key
  const uniqueString = `${Date.now()}-${Math.random()
    .toString(36)
    .substring(2, 15)}`;

  const token = jwt.sign(
    {
      _id: this._id,
      userType: this.userType,
      status: this.status,
      uniqueString: uniqueString,
    },
    secret,
    {
      expiresIn: "30d",
    }
  );
  this.currentDeviceRandomId = uniqueString;

  await this.model("users").updateOne(
    { _id: this._id }, // Filter criteria
    { $set: { currentDeviceRandomId: uniqueString } } // Update operation
  );
  return token;
};
module.exports = mongoose.model("users", UserSchema);
