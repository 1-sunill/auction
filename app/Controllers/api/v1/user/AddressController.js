const mongoose = require("mongoose");
const i18n = require("i18n");
const { ObjectId } = require("mongodb");
const { Validator } = require("node-input-validator");
const User = require("../../../../Models/User");
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
const UserAddress = require("../../../../Models/UserAddress");

module.exports = {
  // Add and Edit Same Function
  addEditAddress: async (req, res) => {
    try {
      var requests = await decrypter(req.body);
      if (requests == false) {
        return response(res, 500, i18n.__("Internal_Error"));
      }
      const v = new Validator(requests, {
        userType: "required|in:bidder,seller",
        type: "required|in:add,edit",
        name: "required",
        mobile: "required",
        countryCode: "required",
        address: "required",
        country: "nullable",
        state: "nullable",
        city: "nullable",
        zipcode: "nullable",
        latitude: "required",
        longitude: "required",
        addressId: "requiredIf:type,edit",
      });
      const matched = await v.check();
      if (!matched) {
        return failedValidation(res, v);
      }
      if (requests.latitude && requests.longitude) {
        let coordinates = [
          parseFloat(requests.longitude),
          parseFloat(requests.latitude),
        ];
        let location = {
          type: "Point",
          coordinates,
        };
        requests.location = location;
      }
      if (requests.type === "edit") {
        let address = await UserAddress.findByIdAndUpdate(
          requests.addressId,
          requests
        );

        return success(res, i18n.__("UPDATEDATA"), address);
      } else {
        // Create a new address if the type is 'add'
        console.log("sas", req.user);
        requests.userId = req.user._id;
        let address = await UserAddress.create(requests);
        return success(res, i18n.__("Added_Successfully"), address);
      }
    } catch (error) {
      dump(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },
  getAddress: async (req, res) => {
    try {
      var requests = await decrypter(req.query);
      if (requests == false) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      const v = new Validator(requests, {
        userType: "required|in:bidder,seller",
      });
      const matched = await v.check();
      if (!matched) {
        return failedValidation(res, v);
      }

      let address = await UserAddress.find({
        userId: req.user._id,
        userType: requests.userType,
        isDeleted: false,
      })
        .sort({ createdAt: -1 })
        .select("-isDeleted -userId -status");
      return success(res, i18n.__("FETCHDATA"), {
        addresses: address,
      });
    } catch (error) {
      dump(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },
  deleteAddress: async (req, res) => {
    try {
      var requests = await decrypter(req.query);
      if (requests == false) {
        return response(res, 500, i18n.__("Internal_Error"));
      }
      const v = new Validator(requests, {
        addressId: "required",
      });
      const matched = await v.check();
      if (!matched) {
        return failedValidation(res, v);
      }
      await UserAddress.findByIdAndUpdate(requests.addressId, {
        isDeleted: true,
      });
      return success(res, i18n.__("DELETED_DATA"));
    } catch (error) {
      dump(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },
};
