const mongoose = require("mongoose");
const i18n = require("i18n");
const bcrypt = require("bcrypt");
const Notification = require("../../../../Models/Notification");
const { ObjectId } = require("mongodb");
const { Validator } = require("node-input-validator");
const User = require("../../../../../app/Models/User");
const {
  success,
  response,
  failedValidation,
  failed,
  authFailed,
  serverError,
  normal,
} = require("../../../../../helper/response");
const { decrypter } = require("../../../../../helper/crypto");
const { dump } = require("../../../../../helper/logs");
const FileUpload = require("../../../../../services/upload-files");
const { request } = require("express");
const { sendNewNotification } = require("../../../../../helper/commonHelper");

module.exports = {
  changePassword: async (req, res) => {
    try {
      var requests = await decrypter(req.body);
      if (requests == false) {
        return response(res, 500, i18n.__("Internal_Error"));
      }
      const v = new Validator(requests, {
        oldPassword: "required",
        newPassword: "required|different:oldPassword|same:confirm_newPassword",
      });

      const matched = await v.check();

      if (!matched) {
        return failedValidation(res, v);
      }

      const userExist = await User.findOne({ _id: req.user._id });

      if (!userExist) {
        return response(res, 422, i18n.__("not_found"));
      }

      const isPasswordMatched = await bcrypt.compare(
        requests.oldPassword,
        userExist.password
      );

      if (!isPasswordMatched) {
        return response(res, 422, i18n.__("Old_password_incorrect"));
      }

      if (requests.oldPassword === requests.newPassword) {
        return response(res, 422, i18n.__("Password_not_same"));
      }

      // Check if the new password matches any of the previous three passwords
      const tempPasswords = userExist.tempPasswords || [];
      const isPreviousPassword = tempPasswords.some((password) =>
        bcrypt.compareSync(requests.newPassword, password)
      );

      if (isPreviousPassword) {
        return response(res, 422, i18n.__("New_password_same_as_previous"));
      }

      // Store the new password in the tempPasswords array
      tempPasswords.push(userExist.password);
      if (tempPasswords.length > 3) {
        tempPasswords.shift(); // Remove the oldest password from the array if it exceeds 3
      }

      let salt = await bcrypt.genSalt(10);
      let hashPassword = await bcrypt.hashSync(requests.newPassword, salt);

      // Update the user's password and tempPasswords array
      await User.findByIdAndUpdate(userExist._id, {
        password: hashPassword,
        tempPasswords: tempPasswords,
      });
      let title = "Green House";
      let message = "Password changed successfully.";
      await sendNewNotification(userExist._id, title, message);
      return response(res, 200, i18n.__("Change_password_success"));
    } catch (error) {
      dump(error);
      return response(res, 500, i18n.__("Internal_Error"));
    }
  },

  profileSwitch: async (req, res) => {
    try {
      console.log("+++++++++++++++qqqqqqqqqq", req.body);
      var requests = await decrypter(req.body);
      if (requests == false) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      const v = new Validator(requests, {
        userType: "required|in:bidder,seller",
        businessName: "requiredIf:userType,seller",
        address: "requiredIf:userType,seller",
        categories: "requiredIf:userType,seller",
        lat: "requiredIf:userType,seller",
        long: "requiredIf:userType,seller",
        licenceNumber: "requiredIf:userType,seller",
        // licenceExpiry: 'requiredIf:userType,seller',
      });

      const matched = await v.check();
      if (!matched) {
        return failedValidation(res, v);
      }

      // Update userType field in the user table
      let userExist = await User.findById(req.user._id);
      if (!userExist) {
        return response(res, 422, i18n.__("not_register"));
      }
      let nationalIdCardImage = "";
      if (requests.userType === "seller") {
        if (!req.files) {
          return response(res, 422, i18n.__("File_required"));
        }
        nationalIdCardImage = await FileUpload.aws(
          req.files.nationalIdCard,
          "IdProofImages"
        );
      }
      let shouldGenerateToken = false;
      if (!userExist.currentDeviceRandomId) {
        shouldGenerateToken = true;
      }
      if (requests.userType === "bidder") {
        userExist.userType = ["bidder", "seller"];
        const userData = await userExist.save();
        let token = await userExist.generateToken();

        return response(res, 200, i18n.__("profile_switch"), {
          userData,
          token,
        });
      }
      if (userExist.userType.includes("seller")) {
        //Check Conditions
        if (userExist.isAttemptCount >= 3) {
          return response(res, 422, i18n.__("Max_Attempts_Exceeded"));
        }
        const result = await resubmitInformationswitchForSeller(
          userExist,
          nationalIdCardImage,
          requests
        );
        if (result.error) {
          return response(res, 422, result.error);
        }
        let token = await userExist.generateToken();
        return response(res, 424, i18n.__("profile_switch_request"), {
          result,
          token,
        });
      }
      userExist.userType = ["bidder", "seller"];

      // If userType is 'seller', save business details to the user table
      if (requests.userType === "seller") {
        if (!req.files) {
          return response(res, 422, i18n.__("File_required"));
        }
        if (requests.lat && requests.long) {
          let coordinates = [
            parseFloat(requests.long),
            parseFloat(requests.lat),
          ];
          let location = {
            type: "Point",
            coordinates,
          };
          requests.location = location;
        }
        nationalIdCardImage = await FileUpload.aws(
          req.files.nationalIdCard,
          "IdProofImages"
        );

        userExist.businessName = requests.businessName;
        userExist.address = requests.address;
        if (requests.categories) {
          userExist.categories = Array.isArray(requests.categories)
            ? requests.categories
            : requests.categories.split(",");
          userExist.categories = requests.categories.map((category) => ({
            categoryId: new ObjectId(category),
          }));
        }
        userExist.adminVerifyStatus =
          requests.userType === "seller" ? "Pending" : "None";
        userExist.location = requests.location;
        userExist.licenceNumber = requests.licenceNumber;
        userExist.nationalIdCard = nationalIdCardImage.Key;
      }
      await userExist.save();
      const responseData = {
        userDetails: userExist,
      };

      if (requests.userType == "seller") {
        return response(
          res,
          424,
          i18n.__("profile_switch_request"),
          responseData
        );
      }

      if (requests.userType == "bidder") {
        return response(res, 200, i18n.__("profile_switch"), responseData);
      }
      return response(res, 200, i18n.__("profile_switch"), responseData);
    } catch (error) {
      dump(error);
      return response(res, 500, i18n.__("Internal_Error"));
    }
  },

  editProfile: async (req, res) => {
    try {
      // Decrypt the request body
      const requests = await decrypter(req.body);
      if (!requests) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      // Validate the request body
      const v = new Validator(requests, {
        userType: "required|in:bidder,seller",
        type: "required|in:business,myProfile",
        name: "requiredIf:type,myProfile",
        businessName: "requiredIf:type,business",
        address: "requiredIf:type,business",
        categories: "requiredIf:type,business",
        lat: "requiredIf:type,business",
        long: "requiredIf:type,business",
        licenceNumber: "requiredIf:type,business",

        // Add other fields as needed
      });
      const matched = await v.check();
      if (!matched) {
        return failedValidation(res, v);
      }

      // Find the user by ID
      let userExist = await User.findById(req.user._id);
      if (!userExist) {
        return response(res, 422, i18n.__("not_register"));
      }

      // Update user details based on the provided information
      // Update only the fields that are present in the request body
      if (requests.type === "myProfile") {
        userExist.name = requests.name;
        userExist.email = requests.email ? requests.email : "";
        userExist.taxRegistrationNumber = requests.taxRegistrationNumber
          ? requests.taxRegistrationNumber
          : "";
      }
      if (requests.userType === "seller") {
        if (requests.type === "business") {
          userExist.businessName = requests.businessName;
          userExist.address = requests.address;
          userExist.licenceNumber = requests.licenceNumber
            ? requests.licenceNumber
            : "";
          userExist.taxRegistrationNumber = requests.taxRegistrationNumber
            ? requests.taxRegistrationNumber
            : "";

          if (requests.categories) {
            userExist.categories = Array.isArray(requests.categories)
              ? requests.categories
              : requests.categories.split(",");
            userExist.categories = requests.categories.map((category) => ({
              categoryId: new ObjectId(category),
            }));
          }
          if (requests.lat && requests.long) {
            let coordinates = [
              parseFloat(requests.long),
              parseFloat(requests.lat),
            ];
            let location = {
              type: "Point",
              coordinates,
            };
            requests.location = location;
          }
          userExist.location = requests.location;
        } else {
          userExist.bio = requests.bio ? requests.bio : "";
        }
      }

      await userExist.save();
      userExist.password = undefined;
      // Prepare response data
      const responseData = {
        userDetails: userExist,
      };

      // Return success response
      return response(res, 200, i18n.__("UPDATEDATA"), responseData);
    } catch (error) {
      console.error(error);
      return response(res, 500, i18n.__("Internal_Error"));
    }
  },

  getUser: async (req, res) => {
    try {
      var requests = await decrypter(req.query);
      if (requests === false) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      const userId = req.user._id;

      // Find the user details by ID
      const user = await User.findById(userId);

      // If user not found, return 404
      if (!user) {
        return response(res, 422, i18n.__("not_register"));
      }

      let userDetails = {
        ...user.toObject(),
        password: undefined,
      };
      // Return the user details
      return success(res, i18n.__("FETCHDATA"), { userDetails });
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },

  deleteAccount: async (req, res) => {
    try {
      var requests = await decrypter(req.query);
      if (requests === false) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      const userId = req.user._id;

      // Find the user details by ID
      const user = await User.findById(userId);

      // If user not found, return 404
      if (!user) {
        return response(res, 422, i18n.__("not_register"));
      }

      // Update the user's isDeleted field to true
      user.isDeleted = true;

      // Save the updated user object
      await user.save();

      // Return the user details
      return success(res, i18n.__("Account_Deleted"));
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },

  notificationList: async (req, res) => {
    try {
      var requests = await decrypter(req.query);
      if (requests === false) {
        return response(res, 500, i18n.__("Internal_Error"));
      }
      let page = requests.page ? parseInt(requests.page) : 1;
      let pageSize = requests.limit ? parseInt(requests.limit) : 10;
      let skipIndex = (page - 1) * pageSize;
      const userId = req.user._id;
      const notification = await Notification.find({ userId: userId })
        .sort({ createdAt: -1 })
        .skip(skipIndex)
        .limit(pageSize);
      const notificationCount = await Notification.countDocuments({
        userId: userId,
      });

      return success(res, i18n.__("FETCHDATA"), {
        notification,
        notificationCount,
      });
    } catch (error) {
      console.log({ error });
      return response(res, 500, i18n.__("Internal_Error"));
    }
  },
};

// Helper function for resubmit seller

const resubmitInformationswitchForSeller = async (
  userExist,
  nationalIdCardImage,
  requests
) => {
  userExist.isAttemptCount += 1;
  userExist.address = requests.address ? requests.address : "";
  if (requests.categories) {
    userExist.categories = Array.isArray(requests.categories)
      ? requests.categories
      : requests.categories.split(",");
    userExist.categories = requests.categories.map((category) => ({
      categoryId: new ObjectId(category),
    }));
  }
  if (requests.lat && requests.long) {
    let coordinates = [parseFloat(requests.long), parseFloat(requests.lat)];
    let location = {
      type: "Point",
      coordinates,
    };
    requests.location = location;
  }
  userExist.location = requests.location;
  userExist.businessName = requests.businessName;
  userExist.licenceNumber = requests.licenceNumber
    ? requests.licenceNumber
    : "";
  userExist.adminVerifyStatus =
    requests.userType === "seller" ? "Pending" : "None";
  userExist.licenceExpiry = requests.licenceExpiry
    ? requests.licenceExpiry
    : "";
  userExist.nationalIdCard = nationalIdCardImage ? nationalIdCardImage.Key : "";
  await userExist.save();

  return { success: true };
};
