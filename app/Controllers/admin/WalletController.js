const Wallet = require("../../Models/Wallet");
const User = require("../../Models/User");
const {
  serverError,
  validateFail,
  success,
} = require("../../../helper/helper");
const { performWalletTransaction } = require("../../../helper/commonHelper");
const { Validator } = require("node-input-validator");
const { ObjectId } = require("mongodb");

module.exports = {
  walletHistory: async (req, res) => {
    try {
      const userId = new ObjectId(req.user._id);
      let {
        page = 1,
        pageSize = 10,
        search = "",
        sort = "",
        startDate,
        endDate,
      } = req.query;
      page = parseInt(page);
      pageSize = parseInt(pageSize);
      const skipIndex = (page - 1) * pageSize;
      let sortOptions = { createdAt: -1 };

      // Sorting options based on sort parameter
      if (sort == 1) {
        sortOptions = { createdAt: 1 };
      } else if (sort == 2) {
        sortOptions = { createdAt: -1 };
      } else if (sort == 3) {
        sortOptions = { "userDetails.name": 1 };
      } else if (sort == 4) {
        sortOptions = { "userDetails.name": -1 };
      }

      const matchQuery = {};

      // Date range condition
      if (startDate && endDate) {
        const start = new Date(startDate);
        start.setUTCHours(0, 0, 0, 0); // Start of the day in UTC
        const end = new Date(endDate);
        end.setUTCHours(23, 59, 59, 999); // End of the day in UTC
        matchQuery.createdAt = {
          $gte: start,
          $lte: end,
        };
      } else if (startDate) {
        const start = new Date(startDate);
        start.setUTCHours(0, 0, 0, 0); // Start of the day in UTC
        const end = new Date(start);
        end.setUTCHours(23, 59, 59, 999); // End of the day in UTC
        matchQuery.createdAt = {
          $gte: start,
          $lte: end,
        };
      } else if (endDate) {
        const start = new Date(endDate);
        start.setUTCHours(0, 0, 0, 0); // Start of the day in UTC
        const end = new Date(endDate);
        end.setUTCHours(23, 59, 59, 999); // End of the day in UTC
        matchQuery.createdAt = {
          $gte: start,
          $lte: end,
        };
      }

      // Search by name
      if (search.trim()) {
        matchQuery["$or"] = [
          { "userDetails.name": { $regex: search, $options: "i" } },
          { "sellerDetails.name": { $regex: search, $options: "i" } },
        ];
      }

      const wallet = await Wallet.aggregate([
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "userDetails",
          },
        },
        { $unwind: { path: "$userDetails", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "users",
            localField: "sellerId",
            foreignField: "_id",
            as: "sellerDetails",
          },
        },
        {
          $unwind: { path: "$sellerDetails", preserveNullAndEmptyArrays: true },
        },
        {
          $match: matchQuery,
        },
        {
          $project: {
            _id: 1,
            userId: 1,
            sellerId: 1,
            transactionType: 1,
            transactionSource: 1,
            amount: 1,
            transactionId: 1,
            createdAt: 1,
            "sellerDetails.userType": 1,
            "sellerDetails.name": 1,
            "userDetails.userType": 1,
            "userDetails.name": 1,
          },
        },
        { $sort: sortOptions },
        { $skip: skipIndex },
        { $limit: pageSize },
      ]);

      let totalItems = await Wallet.aggregate([
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "userDetails",
          },
        },
        { $unwind: { path: "$userDetails", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "users",
            localField: "sellerId",
            foreignField: "_id",
            as: "sellerDetails",
          },
        },
        {
          $unwind: { path: "$sellerDetails", preserveNullAndEmptyArrays: true },
        },
        {
          $match: matchQuery,
        },

        { $sort: sortOptions },
      ]);
      totalItems = totalItems.length;
      return success(res, "Wallet data fetched successfully", {
        wallet,
        totalItems,
      });
    } catch (error) {
      console.error(error);
      return serverError(res, "Internal server error.");
    }
  },
};
