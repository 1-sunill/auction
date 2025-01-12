const { Validator } = require("node-input-validator");
const Order = require("../../../app/Models/Order");
const User = require("../../../app/Models/User");
const SubCategory = require("../../../app/Models/SubCategory");
const Category = require("../../../app/Models/Category");
const Bid = require("../../../app/Models/Bid");
const response = require("../../../helper/helper");
const FileUpload = require("../../../services/upload-files");
const mongoose = require("mongoose");
const Commission = require("../../Models/Comission");
const { ObjectId } = require("mongodb");
const {
  serverError,
  validateFail,
  failed,
  success,
} = require("../../../helper/helper");
const moment = require("moment");

module.exports = {
  getOrders: async (req, res) => {
    try {
      let {
        page = 1,
        pageSize = 10,
        search = "",
        status = "",
        sort = "",
        startDate = "",
        endDate = "",
      } = req.query;
      page = parseInt(page);
      pageSize = parseInt(pageSize);
      const skipIndex = (page - 1) * pageSize;
      let matchQuery = {};

      if (search.trim()) {
        matchQuery["$or"] = [
          { orderId: { $regex: search, $options: "i" } },
          { productenName: { $regex: search, $options: "i" } },
          { userName: { $regex: search, $options: "i" } },
          { sellerfullname: { $regex: search, $options: "i" } },
        ];
      }
      //  status condition
      const currentDate = new Date();
      if (status === "inProcess") {
        matchQuery["orderStatus"] = "Packed";
      } else if (status === "Complete") {
        matchQuery["orderStatus"] = "Delivered";
      } else if (status === "both") {
        matchQuery["$or"] = [{ orderStatus: { $in: ["Delivered", "Packed"] } }];
      }

      // Define sort condition
      // let sortCondition = {};
      // if (sort === "newest") {
      //   sortCondition["createdAt"] = -1;
      // } else if (sort === "oldest") {
      //   sortCondition["createdAt"] = 1;
      // } else if (sort === "asc") {
      //   sortCondition["productenName"] = 1;
      // } else if (sort === "desc") {
      //   sortCondition["productenName"] = -1;
      // }

      // Define sort condition
      let sortCondition = { createdAt: -1 }; // Default sorting by createdAt in descending order

      if (sort == 1) {
        // oldest to newest
        sortCondition = { createdAt: 1 };
      } else if (sort == 2) {
        // newest to oldest
        sortCondition = { createdAt: -1 };
      } else if (sort == 3) {
        // a to z
        sortCondition = { "subCategoryDetails.enName": 1 };
      } else if (sort == 4) {
        // z to a
        sortCondition = { "subCategoryDetails.enName": -1 };
      }
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
      console.log({ matchQuery });
      let aggregationPipeline = [
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
          $lookup: {
            from: "subcategories",
            localField: "subCategoryId",
            foreignField: "_id",
            as: "subCategoryDetails",
          },
        },
        {
          $unwind: {
            path: "$subCategoryDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "products",
            localField: "productId",
            foreignField: "_id",
            as: "productDetails",
          },
        },
        {
          $unwind: {
            path: "$productDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        { $sort: sortCondition },
        {
          $facet: {
            paginatedResults: [
              { $skip: skipIndex },
              { $limit: pageSize },
              {
                $project: {
                  orderId: 1,
                  userId: "$userDetails._id",
                  userName: "$userDetails.userName",
                  userfullname: "$userDetails.name",
                  sellerId: "$sellerDetails._id",
                  sellerfullname: "$sellerDetails.name",
                  sellerName: "$sellerDetails.userName",
                  subCategoryId: "$subCategoryDetails._id",
                  productenName: "$subCategoryDetails.enName",
                  productarName: "$subCategoryDetails.arName",
                  productId: "$productDetails._id",
                  quantity: "$productDetails.quantity",
                  unit: "$productDetails.unit",
                  amount: 1,
                  orderStatus: 1,
                  boxNumber: 1,
                  createdAt: 1,
                  // Add other fields you need
                },
              },
              { $match: matchQuery },
            ],
            totalCount: [{ $count: "count" }],
          },
        },
      ];

      let result = await Order.aggregate(aggregationPipeline);
      let orders = result[0].paginatedResults;
      let totalItems = orders.length ? orders.length : 0;

      return success(res, "Orders fetched successfully!", {
        orders,
        totalItems,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },

  getOrderDetails: async (req, res) => {
    try {
      const v = new Validator(req.query, {
        orderId: "required",
      });

      const matched = await v.check();
      if (!matched) {
        return validateFail(res, v);
      }

      const { orderId } = req.query; // Assuming the order ID is passed as a URL parameter
      const order = await Order.findById(orderId);
      if (!order) {
        return failed(res, "Order not found.", {});
      }
      // Aggregation pipeline for fetching detailed information about a specific order
      const pipeline = [
        {
          $match: {
            _id: new mongoose.Types.ObjectId(orderId), // Ensure to match the specific order ID
          },
        },
        {
          $lookup: {
            from: "users", // Assuming 'users' collection stores both sellers and buyers
            localField: "userId",
            foreignField: "_id",
            as: "userDetails",
          },
        },
        {
          $unwind: "$userDetails", // Deconstructs the userDetails array
        },
        {
          $lookup: {
            from: "users", // Assuming the same 'users' collection contains sellers
            localField: "sellerId",
            foreignField: "_id",
            as: "sellerDetails",
          },
        },
        {
          $unwind: "$sellerDetails",
        },
        {
          $lookup: {
            from: "products", // Joining the 'products' collection
            localField: "productId",
            foreignField: "_id",
            as: "productDetails",
          },
        },
        {
          $unwind: "$productDetails",
        },
        {
          $lookup: {
            from: "subcategories", // Assuming products reference subcategories
            localField: "productDetails.subCategoryId",
            foreignField: "_id",
            as: "subCategoryDetails",
          },
        },
        {
          $unwind: {
            path: "$subCategoryDetails",
            preserveNullAndEmptyArrays: true, // Keeps the document in the pipeline even if subCategoryDetails is not found
          },
        },
        {
          $project: {
            orderId: 1,
            userId: "$userDetails._id",
            userName: "$userDetails.userName",
            userfullname: "$userDetails.name",
            mobile: "$userDetails.mobile",
            countryCode: "$userDetails.countryCode",
            address: "$userDetails.address",
            sellerId: "$sellerDetails._id",
            sellerfullname: "$sellerDetails.name",
            sellerName: "$sellerDetails.userName",
            subCategoryId: "$subCategoryDetails._id",
            productenName: "$subCategoryDetails.enName",
            productarName: "$subCategoryDetails.arName",
            productId: "$productDetails._id",
            quantity: "$productDetails.quantity",
            unit: "$productDetails.unit",
            amount: 1,
            returnReason: 1,
            returnOrderStatus: 1,
            rejectReturnReason: 1,
            adminCommission: 1,
            sellerCommission: 1,
            bidderRefund: 1,
            orderStatus: 1,
            boxNumber: 1,
            boxLength: 1,
            boxHeight: 1,
            boxWidth: 1,
            createdAt: 1,
            shippingMethod: 1,
          },
        },
      ];

      const result = await Order.aggregate(pipeline);

      if (result.length === 0) {
        return res.status(404).json({ message: "Order not found" });
      }

      //   res.json({ message: 'Order details fetched successfully', orderDetails: result[0] });
      return success(res, "Orders  details fetched successfully!", {
        orderDetails: result[0],
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },

  returnRequestAcceptReject: async (req, res) => {
    try {
      const v = new Validator(req.body, {
        orderId: "required",
        returntype: "required|in:accept,reject",
        rejectReason: "requiredIf:returntype,reject",
        adminCommissionPercentage: "requiredIf:returntype,accept|numeric",
        sellerCommissionPercentage: "requiredIf:returntype,accept|numeric",
        bidderRefundPercentage: "requiredIf:returntype,accept|numeric",
      });

      const matched = await v.check();
      if (!matched) {
        return validateFail(res, v);
      }

      const {
        orderId,
        returntype,
        adminCommissionPercentage,
        sellerCommissionPercentage,
        bidderRefundPercentage,
        rejectReason,
      } = req.body;

      const order = await Order.findById(orderId);
      if (!order) {
        return failed(res, "Order not found.", {});
      }

      let adminCommission = "";
      let sellerCommission = "";
      let bidderRefund = "";

      if (returntype === "accept") {
        // Calculate commissions based on percentages
        adminCommission = (adminCommissionPercentage / 100) * order.amount;
        sellerCommission = (sellerCommissionPercentage / 100) * order.amount;
        // Calculate bidder refund
        bidderRefund = order.amount - adminCommission - sellerCommission;

        // Update order document with commission details
        order.adminCommission = adminCommission;
        order.sellerCommission = sellerCommission;
        order.bidderRefund = bidderRefund;
        order.returnOrderStatus = "returnAccept";
        await order.save();
      } else {
        order.returnAcceptAt = new Date().toISOString();
        order.rejectReturnReason = rejectReason;
        order.returnOrderStatus = "returnReject";
        await order.save();
      }

      return success(res, "Order return accept and Reject", {
        orderDetails: order,
        commissions: {
          adminCommission,
          sellerCommission,
          bidderRefund,
        },
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },
  // get commission
  getCommission: async (req, res) => {
    try {
      const data = await Commission.find();
      return success(res, "Data fetched successfully.", { data });
    } catch (error) {
      console.log({ error });
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },

  // update commission
  updateCommission: async (req, res) => {
    try {
      const v = new Validator(req.body, {
        id: "required",
        vat: "max:100",
        commission: "max:100"
      });
  
      const matched = await v.check();
      if (!matched) {
        return validateFail(res, v);
      }
  
      const newData = {
        vat: req.body.vat,
        commission: req.body.commission,
      };
      await Commission.updateOne({ _id: req.body.id }, newData);
      return success(res, "Data updated successfully.");
    } catch (error) {
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },
};
