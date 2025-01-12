const mongoose = require("mongoose");
const i18n = require("i18n");
const bcrypt = require("bcrypt");

const { ObjectId } = require("mongodb");
const { Validator } = require("node-input-validator");
const User = require("../../../app/Models/User");
const {
  success,
  response,
  validateFail,
  failed,
  authFailed,
  serverError,
  normal,
} = require("../../../helper/helper");
const { decrypter } = require("../../../helper/crypto");
const Support = require("../../Models/Support");
const Chat = require("../../Models/Chat");
const { findOneAndDelete } = require("../../Models/Support");
const FileUpload = require("../../../services/upload-files");
const { sendNewNotification } = require("../../../helper/commonHelper");

module.exports = {
  ticketList: async (req, res) => {
    try {
      const validate = new Validator(req.query, {
        supportType: "required",
      });

      const matched = await validate.check();

      if (!matched) {
        return validateFail(res, validate);
      }

      let { page = 1, pageSize = 10, search = "", sortBy } = req.query;
      page = parseInt(page, 10);
      pageSize = parseInt(pageSize, 10);
      const skipIndex = (page - 1) * pageSize;

      const matchQuery = {
        supportType: req.query.supportType,
        roomId: { $ne: 0 },
      };

      if (search.trim()) {
        matchQuery["$or"] = [
          { "userDetail.userName": { $regex: search, $options: "i" } },
          { "userDetail.mobile": { $regex: search, $options: "i" } },
          { "userDetail.name": { $regex: search, $options: "i" } },
        ];
      }

      const pipeline = [
        {
          $match: {
            supportType: req.query.supportType,
            roomId: { $ne: 0 },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "userDetail",
          },
        },
        {
          $unwind: {
            path: "$userDetail",
          },
        },
        {
          $match: matchQuery,
        },
        {
          $facet: {
            list: [
              {
                $project: {
                  _id: 1,
                  roomId: 1,
                  userId: 1,
                  ticketId: 1,
                  supportType: 1,
                  title: 1,
                  message: 1,
                  status: 1,
                  createdAt: 1,
                  updatedAt: 1,
                  "userDetail.userType": 1,
                  "userDetail.userName": 1,
                  "userDetail.name": 1,
                  "userDetail.mobile": 1,
                  "userDetail.countryCode": 1,
                  "userDetail.email": 1,
                },
              },
              { $sort: { createdAt: sortBy === "asc" ? 1 : -1 } },
              { $skip: skipIndex },
              { $limit: pageSize },
            ],
            totalItems: [{ $count: "count" }],
          },
        },
      ];

      const result = await Support.aggregate(pipeline);
      const list = result[0].list;
      const totalItems = result[0].totalItems[0]
        ? result[0].totalItems[0].count
        : 0;

      return success(res, "Data fetched successfully.", { list, totalItems });
    } catch (error) {
      console.log({ error });
      return serverError(res, "Internal server error");
    }
  },

  ticketStatus: async (req, res) => {
    try {
      const validate = new Validator(req.body, {
        id: "required",
      });

      const matched = await validate.check();

      if (!matched) {
        return validateFail(res, validate);
      }

      const support = await Support.findOne({ _id: req.body.id });
      const chat = await Chat.findOne({ ticketId: support.ticketId });
      if (!support) {
        return failed(res, "Support not found.");
      }
      let userId = req.body.id;
      support.status = !support.status; // Toggle the status
      chat.status = !chat.status; // Toggle the status

      let title = "Green House";
      let message = "Your ticket updated successfully.";
      await sendNewNotification(userId, title, message);
      await support.save();
      await chat.save();

      return success(res, "Status updated successfully.", support);
    } catch (error) {
      console.log({ error });
      return serverError(res, "Internal server error");
    }
  },
  ticketDetail: async (req, res) => {
    try {
      const validate = new Validator(req.query, {
        id: "required",
      });

      const matched = await validate.check();

      if (!matched) {
        return validateFail(res, validate);
      }
      const ticketId = new ObjectId(req.query.id);

      const list = await Support.aggregate([
        { $match: { _id: ticketId } },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "userDetail",
          },
        },
        {
          $unwind: {
            //unwind use for make array to object
            path: "$userDetail",
          },
        },
        {
          $project: {
            _id: 1,
            roomId: 1,
            userId: 1,
            ticketId: 1,
            supportType: 1,
            title: 1,
            message: 1,
            status: 1,
            createdAt: 1,
            updatedAt: 1,
            "userDetail.userType": 1,
            "userDetail.userName": 1,
            "userDetail.name": 1,
            "userDetail.mobile": 1,
            "userDetail.countryCode": 1,
            "userDetail.email": 1,
          },
        },
      ]);

      if (!list) {
        return failed(res, "Support not found.");
      }

      return success(res, "Status updated successfully.", list[0]);
    } catch (error) {
      console.log({ error });
      return serverError(res, "Internal server error");
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
        return validateFail(res, validate);
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
      return success(res, "File uploaded successfully.", uploadedImages);
    } catch (error) {
      console.log({ error });
      return serverError(res, "Internal server error");
    }
  },
};
