const mongoose = require("mongoose");
const i18n = require("i18n");
const bcrypt = require("bcrypt");
const FileUpload = require("../../../../../services/upload-files");
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
const Support = require("../../../../Models/Support");
module.exports = {
  supportChat: async (req, res) => {
    try {
      const requests = await decrypter(req.body);
      if (requests === false) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      const validate = new Validator(requests, {
        // roomId: "required",
        userId: "required",
        ticketId: "required",
        supportType: "required",
        title: "required",
      });

      const matched = await validate.check();

      if (!matched) {
        return failedValidation(res, validate);
      }
      const userId = new ObjectId(requests.userId);
      const checkSupport = await Support.findOne({
        ticketId: requests.ticketId,
        roomId: requests.roomId,
      });
      console.log("Support chat is here");
      console.log({ requests });
      // return 1;
      let reqData;
      if (checkSupport) {
        reqData = {
          roomId: requests.roomId,
          userId: requests.userId,
          ticketId: requests.ticketId,
          supportType: requests.supportType,
          title: requests.title,
          message: requests.message,
        };

        await Support.updateOne(
          { ticketId: requests.ticketId, userId: userId },
          reqData
        );
      } else {
        reqData = {
          roomId: requests.roomId,
          userId: requests.userId,
          ticketId: requests.ticketId,
          supportType: requests.supportType,
          title: requests.title,
          message: requests.message,
        };
        await Support.create(reqData);
      }

      return response(res, 200, i18n.__("Data saved successfully."));
    } catch (error) {
      console.error("Error in supportChat:", error);
      return response(res, 500, i18n.__("Internal_Error"));
    }
  },
  ticketList: async (req, res) => {
    try {
      const requests = await decrypter(req.query);

      if (requests === false) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      const validate = new Validator(requests, {
        supportType: "required",
        // statusType: "required",
      });

      const matched = await validate.check();

      if (!matched) {
        return failedValidation(res, validate);
      }

      let page = requests.page ? parseInt(requests.page) : 1;
      let pageSize = requests.limit ? parseInt(requests.limit) : 10;
      let skipIndex = (page - 1) * pageSize;
      let list;
      const userId = req.user._id;
      let params = { supportType: requests.supportType, userId: userId };
      if (requests.statusType) {
        params.status = requests.statusType;
      }
      if (requests.supportType === "helpSupport") {
        list = await Support.find(params)
          .sort({ createdAt: -1 })
          .skip(skipIndex)
          .limit(pageSize);
        const totalItems = await Support.countDocuments(params);

        return success(res, i18n.__("Data fetched successfully"), {
          list,
          totalItems,
        });
      } else {
        list = await Support.findOne({
          supportType: requests.supportType,
          ticketId: requests.ticketId,
        });
        console.log("requests.supportType", requests.supportType);

        return success(res, i18n.__("Data fetched successfully"), {
          list,
        });
      }
    } catch (error) {
      return response(res, 500, i18n.__("Internal_Error"));
    }
  },
  imageUpload: async (req, res) => {
    try {
      const requests = await decrypter(req.files);
      if (requests === false) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      const validate = new Validator(req.files, {
        images: "required",
      });

      const matched = await validate.check();

      if (!matched) {
        return failedValidation(res, validate);
      }
      const uploadedImages = [];
      // console.log(req.files.images);

      if (Array.isArray(req.files.images)) {
        // If multiple images are uploaded
        for (const image of req.files.images) {
          const uploadedFile = await FileUpload.aws(image, "ChatImages");
          uploadedImages.push(process.env.AWS_URL + uploadedFile.Key);
        }
      } else {
        // If only one image is uploaded
        const uploadedFile = await FileUpload.aws(
          req.files.images,
          "ChatImages"
        );
        uploadedImages.push(process.env.AWS_URL + uploadedFile.Key);
      }
      return success(res, i18n.__("Data saved successfully"), uploadedImages);
    } catch (error) {
      console.log({ error });
      return response(res, 500, i18n.__("Internal_Error"));
    }
  },
};
