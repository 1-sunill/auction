const { Validator } = require("node-input-validator");
const FileUpload = require("../../../../../../services/upload-files");
const bcrypt = require("bcrypt");
const i18n = require("i18n");
const mongoose = require("mongoose");
const { ObjectId } = require("mongodb");
const Product = require("../../../../../Models/Product");
const User = require("../../../../../Models/User");
const Bid = require("../../../../../Models/Bid");
const SubCategory = require("../../../../../Models/SubCategory");
const Order = require("../../../../../Models/Order");
const moment = require("moment");
const {
  performWalletTransaction,
} = require("../../../../../../helper/commonHelper");

const {
  success,
  response,
  failedValidation,
  failed,
  authFailed,
  serverError,
} = require("../../../../../../helper/response");
const { decrypter } = require("../../../../../../helper/crypto");
const { dump } = require("../../../../../../helper/logs");
const { request } = require("express");

module.exports = {
  addBidding: async (req, res) => {
    try {
      // Decrypt the request body
      var requests = await decrypter(req.body);
      if (requests === false) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      // Validate the decrypted request
      const v = new Validator(requests, {
        productId: "required",
        bidType: "required|in:featured,purchase",
        amount: "required",
        biddingDate: "requiredIf:bidType,featured|date",
      });

      const matched = await v.check();
      if (!matched) {
        return failedValidation(res, v);
      }

      const existsProduct = await Product.findOne({ _id: requests.productId });

      if (!existsProduct) {
        return response(res, 422, i18n.__("NOTFOUND"));
      }

      if (requests.bidType === "purchase") {
        if (existsProduct.price > requests.amount) {
          return response(
            res,
            422,
            i18n.__("Bid_amount_greaterthan_product_price")
          );
        }
      }
      if (requests.bidType === "featured") {
        const biddingDate = requests.biddingDate; // Assuming biddingDate is in "YYYY-MM-DD" format

        const startOfDay = new Date(biddingDate + "T00:00:00Z");
        const endOfDay = new Date(biddingDate + "T23:59:59Z");

        const checkHighestBid = await Bid.aggregate([
          {
            $match: {
              biddingDate: {
                $gte: startOfDay,
                $lt: endOfDay,
              },
            },
          },
          {
            $sort: {
              amount: -1,
            },
          },
          {
            $limit: 1,
          },
        ]);

        console.log(checkHighestBid, "++++++++++++++");

        if (checkHighestBid.length > 0) {
          const highestBidAmount = checkHighestBid[0].amount;

          if (parseFloat(requests.amount) <= parseFloat(highestBidAmount)) {
            return response(
              res,
              422,
              i18n.__("Bid_amount_greaterthan_product_price")
            );
          }
        } else {
          console.log(00000000000000000000);
          // Handle the case when there are no bids, if needed.
        }
      }

      const today = new Date();
      const currentDate = moment(today).format("YYYY-MM-DD");
      const startDateReq = moment(existsProduct.startDate).format("YYYY-MM-DD");
      const endDateReq = moment(existsProduct.endDate).format("YYYY-MM-DD");
      // console.log(existsProduct.endDate);
      // console.log({ today });
      // if (!moment(existsProduct.endDate).isAfter(today)) {
      //   return response(res, 422, i18n.__("expired_product"));
      // }

      let biddingDate;
      // if (requests.biddingDate) {
      //   biddingDate = moment(requests.biddingDate).format("YYYY-MM-DD");

      //   if (!moment(biddingDate).isBefore(moment(endDateReq))) {
      //     return response(
      //       res,
      //       422,
      //       i18n.__("Bid_amount_greaterthan_product_price")
      //     );
      //   } else if (!moment(biddingDate).isAfter(moment(startDateReq))) {
      //     return response(res, 422, i18n.__("Bidding_Date_greater_startDate"));
      //   } else if (!moment(biddingDate).isAfter(moment(currentDate))) {
      //     return response(
      //       res,
      //       422,
      //       i18n.__("Bidding_Date_greater_currentDate")
      //     );
      //   }
      // }
      const user = await User.findOne({ _id: req.user._id });
      // console.log(user.availableWalletAmount);
      // console.log(requests.amount);

      if (user.availableWalletAmount < parseFloat(requests.amount)) {
        return response(
          res,
          422,
          `Your available amount (${user.availableWalletAmount}) is insufficient for this bidding.`
        );
      }
      let params = {};
      if (requests.bidType == "featured") {
        params = Object.assign(params, {
          subCategoryId: existsProduct.subCategoryId,
          biddingDate: requests.biddingDate ? requests.biddingDate : null,
          bidType: requests.bidType,
        });
      } else {
        params = Object.assign(params, {
          subCategoryId: existsProduct.subCategoryId,
          productId: requests.productId,
          biddingDate: requests.biddingDate ? requests.biddingDate : null,
          bidType: requests.bidType,
        });
      }

      // Check if the new bid amount is greater than the highest bid amount for the same product
      const highestBid = await Bid.findOne(params).sort({
        amount: -1,
      });

      if (highestBid && requests.amount <= highestBid.amount) {
        return response(res, 422, i18n.__("Bid_amount_Check_highest_amount"));
      }

      let query = {};
      if (requests.bidType == "featured") {
        query = Object.assign(query, {
          userId: new ObjectId(req.user._id),
          subCategoryId: new ObjectId(existsProduct.subCategoryId),
          biddingDate: requests.biddingDate ? requests.biddingDate : null,
          bidType: requests.bidType,
        });
      } else {
        query = Object.assign(query, {
          userId: new ObjectId(req.user._id),
          productId: new ObjectId(requests.productId),
          subCategoryId: new ObjectId(existsProduct.subCategoryId),
          biddingDate: requests.biddingDate ? requests.biddingDate : null,
          bidType: requests.bidType,
        });
      }
      // Check if a bid already exists for the same user, product, and bidding date
      const existingBid = await Bid.findOne(query);
      //User Detail

      const totalAmount = user.walletTotalAmount - parseFloat(requests.amount);
      //Freez the request amount
      await User.updateOne(
        { _id: req.user._id },
        {
          freezedWalletAmount: parseFloat(requests.amount),
          availableWalletAmount: totalAmount,
        }
      );

      if (existingBid) {
        existingBid.amount = requests.amount;
        if (requests.amount) {
          existingBid.secondHighestBidAmount = existingBid.amount;
        }
        const updatedBid = await existingBid.save();
        await Bid.updateMany(
          { productId: new ObjectId(requests.productId) },
          {
            $set: {
              highestBidAmount: requests.amount,
              bidCreatedDate: new Date(),
            },
          }
        );
        const userBids = await Bid.find({
          userId: req.user._id,
          bidStatus: "pending",
        });
        const totalBidAmount = userBids.reduce(
          (sum, bid) => sum + bid.amount,
          0
        );
        // const totalBidAmount = parseFloat(requests.amount);
        const totalAmountUpdated = user.walletTotalAmount - totalBidAmount;

        // if (totalAmountUpdated < totalBidAmount) {
        //   return response(
        //     res,
        //     422,
        //     `Your available wallet amount (${user.availableWalletAmount}) after considering pending bids is insufficient for this bidding.`
        //   );
        // }

        await User.updateOne(
          { _id: req.user._id },
          {
            freezedWalletAmount: totalBidAmount,
            availableWalletAmount: totalAmountUpdated,
          }
        );
        return success(res, i18n.__("UPDATEDATA"), updatedBid);
      }

      const newBid = new Bid({
        userId: new ObjectId(req.user._id),
        productId: requests.productId,
        sellerId: existsProduct.sellerId,
        subCategoryId: existsProduct.subCategoryId,
        bidType: requests.bidType,
        amount: requests.amount,
        biddingDate: requests.biddingDate ? requests.biddingDate : null,
        bidType: requests.bidType,
        secondHighestBidAmount: requests.amount,
        bidCreatedDate: new Date(),
      });

      // Save the new product to the database
      const savedBid = await newBid.save();
      // await Bid.updateMany({ productId: new ObjectId(requests.productId)},{ $set:{highestBidAmount:amount} })
      const secondHighestBids = await Bid.find({
        productId: requests.productId,
      }).sort({
        amount: -1,
      });
      if (secondHighestBids.length > 1) {
        await Bid.updateMany(
          { productId: new ObjectId(requests.productId) },
          { $set: { secondHighestBidAmount: secondHighestBids[1].amount } }
        );
      }

      // await Bid.updateMany({ productId: new ObjectId(requests.productId)},{ $set:{highestBidAmount:amount} })
      await Bid.updateMany(
        { productId: new ObjectId(requests.productId) },
        { $set: { highestBidAmount: requests.amount } }
      );

      const userBids = await Bid.find({
        userId: req.user._id,
        bidStatus: "pending",
      });
      const totalBidAmount = userBids.reduce((sum, bid) => sum + bid.amount, 0);
      console.log("###############", totalBidAmount);
      const totalAmountUpdated = user.walletTotalAmount - totalBidAmount;

      // if (totalAmountUpdated < totalBidAmount) {
      //   return response(
      //     res,
      //     422,
      //     `Your available wallet amount (${user.availableWalletAmount}) after considering pending bids is insufficient for this bidding.`
      //   );
      // }
      await User.updateOne(
        { _id: req.user._id },
        {
          freezedWalletAmount: totalBidAmount,
          availableWalletAmount: totalAmountUpdated,
        }
      );
      console.log(savedBid, "sds");

      return success(res, i18n.__("Added_Successfully"), savedBid);
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },

  listHighestBidForProductFeatured: async (req, res) => {
    try {
      console.log(req.user._id);
      var requests = await decrypter(req.query);
      if (requests == false) {
        return response(res, 500, i18n.__("Internal_Error"));
      }
      const v = new Validator(requests, {
        biddingDate: "required",
        // subCategoryId: "required",
      });
      const matched = await v.check();
      if (!matched) {
        return failedValidation(res, v);
      }

      const { subCategoryId, biddingDate } = requests;

      let query = {
        bidType: "featured",
      };

      if (subCategoryId) {
        query.subCategoryId = new ObjectId(subCategoryId);
      }

      if (biddingDate) {
        query.biddingDate = new Date(biddingDate);
      }

      const highestBid = await Bid.aggregate([
        {
          $match: query,
        },
        {
          $sort: {
            amount: -1,
          },
        },
        {
          $limit: 10,
        },
        {
          $lookup: {
            from: "subcategories",
            localField: "subCategoryId",
            foreignField: "_id",
            as: "subcategory",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        {
          $addFields: {
            subCategoryName: {
              _id: {
                $arrayElemAt: ["$subcategory._id", 0],
              },
              enName: {
                $arrayElemAt: ["$subcategory.enName", 0],
              },
              arName: {
                $arrayElemAt: ["$subcategory.arName", 0],
              },
            },
            userName: {
              $arrayElemAt: ["$user.userName", 0],
            },
          },
        },
        {
          $project: {
            _id: 1,
            userId: 1,
            userName: 1,
            productId: 1,
            bidType: 1,
            amount: 1,
            biddingDate: 1,
            subCategoryName: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ]);

      // Respond with the highest bid information
      return success(res, i18n.__("FETCHDATA"), {
        highestBid,
      });
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },

  HighestBidForProductFeatured: async (req, res) => {
    try {
      var requests = await decrypter(req.query);
      if (requests == false) {
        return response(res, 500, i18n.__("Internal_Error"));
      }
      const v = new Validator(requests, {
        productId: "required",
        bidType: "required|in:featured,purchase",
        biddingDate: "requiredIf:bidType,featured|date",
      });

      const matched = await v.check();
      if (!matched) {
        return failedValidation(res, v);
      }

      const existsProduct = await Product.findOne({ _id: requests.productId });

      if (!existsProduct) {
        return response(res, 422, i18n.__("NOTFOUND"));
      }

      let biddingDate;
      if (requests.biddingDate) {
        biddingDate = moment(requests.biddingDate).format("YYYY-MM-DD");
      }
      let params = {};
      if (requests.bidType == "featured") {
        params = Object.assign(params, {
          subCategoryId: existsProduct.subCategoryId,
          biddingDate: requests.biddingDate ? biddingDate : null,
          bidType: requests.bidType,
        });
      } else {
        params = Object.assign(params, {
          subCategoryId: existsProduct.subCategoryId,
          productId: requests.productId,
          biddingDate: requests.biddingDate ? biddingDate : null,
          bidType: requests.bidType,
        });
      }
      const highestBid = await Bid.findOne(params).sort({
        amount: -1,
      });

      // Find the count of bids for the product based on the bid type and bidding date
      const biddingCount = await Bid.countDocuments(params);

      // Fetch the subcategory details
      const subcategory = await SubCategory.findById(
        existsProduct.subCategoryId
      );

      // Respond with the highest bid
      return success(res, i18n.__("FETCHDATA"), {
        highestBid,
        biddingCount,
        endDate: existsProduct.endDate,
        productPrice: existsProduct.price,
        quantity: existsProduct.quantity,
        productId: existsProduct._id,
        sellerId: existsProduct.sellerId,
        unit: existsProduct.unit,
        productImageUrl: existsProduct
          ? existsProduct.imageUrl[0] || null
          : null,
        subcategory: subcategory
          ? {
              _id: subcategory._id,
              enName: subcategory.enName,
              arName: subcategory.arName,
              categoryId: subcategory.categoryId,
            }
          : null,
      });
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },
  // Bidding history for  Product wise
  biddingHistoryForProduct: async (req, res) => {
    try {
      var requests = await decrypter(req.query);
      if (requests == false) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      // Extract request parameters or set defaults
      let page = requests.page ? parseInt(requests.page) : 1;
      let pageSize = requests.limit ? parseInt(requests.limit) : 10;
      let skipIndex = (page - 1) * pageSize;

      const v = new Validator(requests, {
        productId: "required",
      });

      const matched = await v.check();
      if (!matched) {
        return failedValidation(res, v);
      }

      const existsProduct = await Product.findOne({ _id: requests.productId });

      if (!existsProduct) {
        return response(res, 422, i18n.__("NOTFOUND"));
      }

      const result = await Bid.aggregate([
        {
          $match: {
            productId: existsProduct._id,
            bidType: "purchase",
          },
        },
        {
          $sort: { amount: -1 },
        },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        {
          $unwind: "$user",
        },
        {
          $lookup: {
            from: "products",
            localField: "productId",
            foreignField: "_id",
            as: "product",
          },
        },
        {
          $unwind: "$product",
        },
        {
          $facet: {
            bids: [
              { $skip: skipIndex },
              { $limit: pageSize },
              {
                $project: {
                  _id: 1,
                  userId: 1,
                  sellerId: "$product.sellerId",
                  subCategoryId: 1,
                  endDate: "$product.endDate",
                  quantity: "$product.quantity",
                  unit: "$product.unit",
                  productId: 1,
                  bidType: 1,
                  amount: 1,
                  bidCreatedDate: 1,
                  imageUrl: {
                    $cond: {
                      if: { $isArray: "$product.images" },
                      then: {
                        $concat: [
                          process.env.AWS_URL,
                          { $arrayElemAt: ["$product.images.productImage", 0] },
                        ],
                      },
                      else: "",
                    },
                  },
                  createdAt: 1,
                  updatedAt: 1,
                  userName: "$user.userName", // Include userName from the user object
                  name: "$user.name",
                },
              },
            ],
            totalCount: [{ $count: "count" }],
          },
        },
      ]);

      const bids = result[0].bids;
      const totalCount =
        result[0].totalCount.length > 0 ? result[0].totalCount[0].count : 0;
      // Respond with the bidding history including user details and product images
      return success(res, i18n.__("FETCHDATA"), {
        highestBid: bids,
        count: totalCount,
      });
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },
  //Seller End Highest bid for My Products
  HighestBiddingForMyProducts: async (req, res) => {
    try {
      // Decrypt the request body
      var requests = await decrypter(req.query);
      if (requests === false) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      const user = await User.findOne({ _id: new ObjectId(req.user._id) });

      if (!user) {
        return response(res, 422, i18n.__("NOTFOUND"));
      }

      let page = requests.page ? parseInt(requests.page) : 1;
      let pageSize = requests.limit ? parseInt(requests.limit) : 10;
      let skipIndex = (page - 1) * pageSize;
      let search = requests.search ? requests.search : "";
      let category = requests.category ? requests.category : "";
      let categoryName = requests.categoryName ? requests.categoryName : "";

      let remainingHours = requests.remainingHours
        ? parseInt(requests.remainingHours)
        : "";
      let params = {
        sellerId: new ObjectId(user._id),
        bidType: "purchase", // Add condition for bidType
        // isDeleted: false,
        // // status: true,
      };
      if (remainingHours && remainingHours != "") {
        const currentTime = new Date();
        const timeThreshold = new Date(
          currentTime.getTime() + remainingHours * 60 * 60 * 1000
        );
        params.endDate = {
          $lte: timeThreshold,
          $gte: currentTime,
        };
      }
      console.log(params, "sds");
      if (category && category != "") {
        params.categoryId = new ObjectId(category);
      }
      if (categoryName) {
        // Use a case-insensitive regex match for categoryName
        const regex = new RegExp(categoryName, "i");
        params.$or = [
          { "category.enName": { $regex: regex } },
          { "category.arName": { $regex: regex } },
        ];
        console.log("categoryName", regex);
      }

      if (search && search != "") {
        const regex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/g;
        // Use the replace() function to remove the special characters
        if (search.match(regex)) {
          return success(res, i18n.__("FETCHDATA"), {
            mybids: [],
            count: 0,
          });
        }
        let searchnew = search.replace(regex, "");
        // Find subcategory by name
        params = Object.assign(params, {
          $or: [
            { "subCategory.enName": { $regex: searchnew, $options: "i" } },
            { "subCategory.arName": { $regex: searchnew, $options: "i" } },
          ],
        });
      }

      const today = new Date();
      const currentDate = moment(today).format("YYYY-MM-DD");
      console.log(currentDate, "sdad");
      // Aggregate pipeline to find the highest bid for each product made by the user

      const highestBids = await Bid.aggregate([
        {
          $lookup: {
            from: "products",
            localField: "productId",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },
        { $match: { "product.endDate": { $gt: new Date() } } },
        {
          $lookup: {
            from: "subcategories",
            localField: "product.subCategoryId",
            foreignField: "_id",
            as: "subCategory",
          },
        },
        { $unwind: "$subCategory" },
        {
          $lookup: {
            from: "categories",
            localField: "subCategory.categoryId",
            foreignField: "_id",
            as: "category",
          },
        },
        { $unwind: "$category" },
        {
          $lookup: {
            from: "users",
            localField: "product.sellerId",
            foreignField: "_id",
            as: "seller",
          },
        },
        { $unwind: "$seller" },
        { $match: params },
        { $sort: { "product.createdAt": -1 } }, // Ensure we are sorting before grouping to maintain order
        { $match: { "product.isDeleted": false, "product.status": true } }, // Filter products
        // Group by product ID to consolidate bids for the same product
        {
          $group: {
            _id: "$product._id",
            productDetails: { $first: "$$ROOT" }, // Use $first to capture the full document structure once per product
          },
        },
        // Replace the root to bring productDetails to the top level
        {
          $replaceRoot: { newRoot: "$productDetails" },
        },
        // Now apply the facet for pagination and counting
        {
          $facet: {
            myBidData: [
              // Already sorted and unique, now just apply pagination
              { $skip: skipIndex },
              { $limit: pageSize },
              {
                $project: {
                  highestBidAmount: 1, // Or use $max aggregation to find highest bid amount within each group if necessary
                  myBidAmount: "$amount",
                  auctionStatus: "pending",
                  productDetails: {
                    productId: "$product._id",
                    sellerId: "$product.sellerId",
                    userName: "$seller.userName",
                    quantity: "$product.quantity",
                    unit: "$product.unit",
                    productPrice: "$product.price",
                    description: "$product.description",
                    mobile: "$product.mobile",
                    countryCode: "$product.countryCode",
                    productLocation: "$product.productLocation",
                    startDate: "$product.startDate",
                    endDate: "$product.endDate",
                    startTime: "$product.startTime",
                    endTime: "$product.endTime",
                    status: "$product.status",
                    isDeleted: "$product.isDeleted",
                    createdAt: "$product.createdAt",
                    updatedAt: "$product.updatedAt",
                    imageUrl: {
                      $cond: {
                        if: { $isArray: "$product.images" },
                        then: {
                          $concat: [
                            process.env.AWS_URL,
                            {
                              $arrayElemAt: ["$product.images.productImage", 0],
                            },
                          ],
                        },
                        else: "",
                      },
                    },
                    subCategory: {
                      _id: "$subCategory._id",
                      enName: "$subCategory.enName",
                      arName: "$subCategory.arName",
                    },
                    category: {
                      _id: "$category._id",
                      enName: "$category.enName",
                      arName: "$category.arName",
                    },
                  },
                },
              },
            ],
            totalCount: [
              // Count the total unique products after filtering but before pagination
              { $count: "count" },
            ],
          },
        },
      ]);

      // Continue with handling the result

      if (!highestBids || highestBids.length === 0) {
        // If the user hasn't made any bids, return 404
        return response(res, 422, i18n.__("NOTFOUND"));
      }
      const myBidData = highestBids[0].myBidData;
      const totalCount =
        highestBids[0].totalCount.length > 0
          ? highestBids[0].totalCount[0].count
          : 0;

      return success(res, i18n.__("FETCHDATA"), {
        mybids: myBidData,
        count: totalCount,
      });
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },

  //Seller End Highest Bid For featured Product

  FeaturedHighestBiddingForMyProducts: async (req, res) => {
    try {
      // Decrypt the request body
      const requests = await decrypter(req.query);
      if (!requests) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      const user = await User.findOne({ _id: new ObjectId(req.user._id) });
      if (!user) {
        return response(res, 422, i18n.__("NOTFOUND"));
      }

      const page = requests.page ? parseInt(requests.page, 10) : 1;
      const pageSize = requests.limit ? parseInt(requests.limit, 10) : 10;
      const skipIndex = (page - 1) * pageSize;
      const search = requests.search ? requests.search : "";
      const category = requests.category ? requests.category : "";

      let params = {
        sellerId: new ObjectId(user._id),
        bidType: "featured",
      };

      if (category) {
        params.categoryId = new ObjectId(category);
      }

      if (search) {
        const regex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/g;
        if (search.match(regex)) {
          return success(res, i18n.__("FETCHDATA"), {
            mybids: [],
            count: 0,
          });
        }

        const searchnew = search.replace(regex, "");
        params = {
          ...params,
          $or: [
            { "subCategory.enName": { $regex: searchnew, $options: "i" } },
            { "subCategory.arName": { $regex: searchnew, $options: "i" } },
          ],
        };
      }

      const today = new Date();
      const currentDate = moment(today).format("YYYY-MM-DD");

      const highestBids = await Bid.aggregate([
        {
          $lookup: {
            from: "products",
            localField: "productId",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },
        {
          $match: {
            "product.endDate": {
              $gt: new Date(),
            },
          },
        },
        {
          $lookup: {
            from: "subcategories",
            localField: "product.subCategoryId",
            foreignField: "_id",
            as: "subCategory",
          },
        },
        { $unwind: "$subCategory" },
        {
          $lookup: {
            from: "users",
            localField: "product.sellerId",
            foreignField: "_id",
            as: "seller",
          },
        },
        { $unwind: "$seller" },
        { $match: params },
        {
          $facet: {
            myBidData: [
              { $sort: { createdAt: -1 } },
              { $skip: skipIndex },
              { $limit: pageSize },
              {
                $project: {
                  highestBidAmount: 1,
                  myBidAmount: "$amount",
                  auctionStatus: "pending",
                  productDetails: {
                    productId: "$product._id",
                    sellerId: "$product.sellerId",
                    userName: "$seller.userName",
                    quantity: "$product.quantity",
                    unit: "$product.unit",
                    productPrice: "$product.price",
                    description: "$product.description",
                    mobile: "$product.mobile",
                    countryCode: "$product.countryCode",
                    productLocation: "$product.productLocation",
                    startDate: "$product.startDate",
                    endDate: "$product.endDate",
                    startTime: "$product.startTime",
                    endTime: "$product.endTime",
                    status: "$product.status",
                    isDeleted: "$product.isDeleted",
                    createdAt: "$product.createdAt",
                    updatedAt: "$product.updatedAt",
                    imageUrl: {
                      $cond: {
                        if: { $isArray: "$product.images" },
                        then: {
                          $concat: [
                            process.env.AWS_URL,
                            {
                              $arrayElemAt: ["$product.images.productImage", 0],
                            },
                          ],
                        },
                        else: "",
                      },
                    },
                    category: {
                      _id: "$category._id",
                      enName: "$category.enName",
                      arName: "$category.arName",
                    },
                  },
                },
              },
            ],
            totalCount: [{ $count: "count" }],
          },
        },
      ]);

      if (!highestBids || highestBids.length === 0) {
        return response(res, 422, i18n.__("NOTFOUND"));
      }

      const myBidData = highestBids[0].myBidData;
      const totalCount =
        highestBids[0].totalCount.length > 0
          ? highestBids[0].totalCount[0].count
          : 0;

      return success(res, i18n.__("FETCHDATA"), {
        mybids: myBidData,
        count: totalCount,
      });
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },
  // HighestBidForAllProductFeatured: async (req, res) => {
  //   try {
  //     var requests = await decrypter(req.query);
  //     if (requests == false) {
  //       return response(res, 500, i18n.__("Internal_Error"));
  //     }

  //     const userId = new ObjectId(req.user._id);

  //     let query = {
  //       sellerId: userId,
  //       bidType: "featured",
  //     };

  //     let currentDate = new Date();
  //     let biddingDate = moment(currentDate).format("YYYY-MM-DD");

  //     if (biddingDate) {
  //       query.biddingDate = new Date(biddingDate);
  //     }

  //     const highestBid = await Bid.aggregate([
  //       {
  //         $match: query,
  //       },
  //       {
  //         $sort: {
  //           amount: -1,
  //         },
  //       },
  //       {
  //         $limit: 10,
  //       },
  //       {
  //         $lookup: {
  //           from: "bids",
  //           // let: {
  //           //   subCategoryId: "$subCategoryId",
  //           // },
  //           pipeline: [
  //             {
  //               $match: {
  //                 $expr: {
  //                   $and: [
  //                     // { $eq: ["$subCategoryId", "$$subCategoryId"] },
  //                     { $eq: ["$biddingDate", new Date(biddingDate)] },
  //                   ],
  //                 },
  //               },
  //             },
  //             {
  //               $count: "total", // Count the number of documents
  //             },
  //           ],
  //           as: "selfSubCats",
  //         },
  //       },
  //       {
  //         $lookup: {
  //           from: "subcategories",
  //           localField: "subCategoryId",
  //           foreignField: "_id",
  //           as: "subcategory",
  //         },
  //       },
  //       {
  //         $lookup: {
  //           from: "users",
  //           localField: "userId",
  //           foreignField: "_id",
  //           as: "user",
  //         },
  //       },
  //       {
  //         $lookup: {
  //           from: "products",
  //           localField: "productId",
  //           foreignField: "_id",
  //           as: "product",
  //         },
  //       },
  //       {
  //         $addFields: {
  //           selfSubCatsCount: { $arrayElemAt: ["$selfSubCats.total", 0] },
  //           subCategoryName: {
  //             _id: { $arrayElemAt: ["$subcategory._id", 0] },
  //             enName: { $arrayElemAt: ["$subcategory.enName", 0] },
  //             arName: { $arrayElemAt: ["$subcategory.arName", 0] },
  //           },
  //           userName: { $arrayElemAt: ["$user.userName", 0] },
  //           productDetails: { $arrayElemAt: ["$product", 0] },
  //         },
  //       },
  //       {
  //         $project: {
  //           _id: 1,
  //           userId: 1,
  //           userName: 1,
  //           productId: 1,
  //           bidType: 1,
  //           amount: 1,
  //           biddingDate: 1,
  //           subCategoryId: 1,
  //           subCategoryName: 1,
  //           totalBids: "$selfSubCatsCount",
  //           productDetails: {
  //             _id: 1,
  //             sellerId: 1,
  //             name: 1,
  //             quantity: 1,
  //             productLocation: 1,
  //             unit: 1,
  //             price: 1,
  //             description: 1,
  //             imageUrl: {
  //               $cond: {
  //                 if: { $isArray: "$productDetails.images.productImage" },
  //                 then: {
  //                   $concat: [
  //                     process.env.AWS_URL,
  //                     {
  //                       $arrayElemAt: [
  //                         "$productDetails.images.productImage",
  //                         0,
  //                       ],
  //                     },
  //                   ],
  //                 },
  //                 else: "",
  //               },
  //             },
  //           },
  //           createdAt: 1,
  //           updatedAt: 1,
  //         },
  //       },
  //     ]);

  //     for (let index = 0; index < highestBid.length; index++) {
  //       let SellerObject = "";
  //       let checkRank = await Bid.aggregate([
  //         {
  //           $match: {
  //             bidType: "featured",
  //             subCategoryId: highestBid[index].subCategoryId,
  //             biddingDate: new Date(biddingDate),
  //           },
  //         },
  //         {
  //           $sort: {
  //             amount: -1,
  //           },
  //         },
  //       ]);

  //       for (let i = 0; i < checkRank.length; i++) {
  //         checkRank[i].rank = i + 1;

  //         if (checkRank[i].sellerId.toString() == userId.toString()) {
  //           SellerObject = checkRank[i];
  //         }
  //       }

  //       highestBid[index].rank = SellerObject.rank;
  //     }

  //     // Respond with the highest bid information and subcategory bid counts
  //     return success(res, i18n.__("FETCHDATA"), {
  //       highestBid,
  //     });
  //   } catch (error) {
  //     console.error(error);
  //     return serverError(res, 500, i18n.__("Internal_Error"));
  //   }
  // },
  HighestBidForAllProductFeatured: async (req, res) => {
    try {
      var requests = await decrypter(req.query);
      if (requests == false) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      const userId = new ObjectId(req.user._id);

      let query = {
        sellerId: userId,
        bidType: "featured",
      };

      let currentDate = new Date();
      let biddingDate = moment(currentDate).format("YYYY-MM-DD");

      if (biddingDate) {
        query.biddingDate = new Date(biddingDate);
      }

      const highestBid = await Bid.aggregate([
        // {
        //   $match: query,
        // },
        {
          $lookup: {
            from: "products",
            localField: "productId",
            foreignField: "_id",
            as: "product",
          },
        },
        {
          $unwind: "$product",
        },
        {
          $match: {
            "product.isFeatured": true,
          },
        },
        {
          $sort: {
            amount: -1,
          },
        },
        {
          $limit: 10,
        },
        // {
        //   $lookup: {
        //     from: "bids",
        //     pipeline: [
        //       {
        //         $match: {
        //           $expr: {
        //             $and: [{ $eq: ["$biddingDate", new Date(biddingDate)] }],
        //           },
        //         },
        //       },
        //       {
        //         $count: "total",
        //       },
        //     ],
        //     as: "selfSubCats",
        //   },
        // },
        {
          $lookup: {
            from: "subcategories",
            localField: "subCategoryId",
            foreignField: "_id",
            as: "subcategory",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        {
          $addFields: {
            selfSubCatsCount: 0,
            subCategoryName: {
              _id: { $arrayElemAt: ["$subcategory._id", 0] },
              enName: { $arrayElemAt: ["$subcategory.enName", 0] },
              arName: { $arrayElemAt: ["$subcategory.arName", 0] },
            },
            userName: { $arrayElemAt: ["$user.userName", 0] },
            productDetails: "$product",
          },
        },
        {
          $project: {
            _id: 1,
            userId: 1,
            userName: 1,
            productId: 1,
            bidType: 1,
            amount: 1,
            biddingDate: 1,
            subCategoryId: 1,
            subCategoryName: 1,
            totalBids: "$selfSubCatsCount",
            productDetails: {
              _id: 1,
              sellerId: 1,
              name: 1,
              quantity: 1,
              productLocation: 1,
              unit: 1,
              price: 1,
              description: 1,
              isFeatured: 1,
              imageUrl: {
                $cond: {
                  if: { $isArray: "$productDetails.images.productImage" },
                  then: {
                    $concat: [
                      process.env.AWS_URL,
                      {
                        $arrayElemAt: [
                          "$productDetails.images.productImage",
                          0,
                        ],
                      },
                    ],
                  },
                  else: "",
                },
              },
            },
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ]);

      const subCategoryRanks = {};

      for (let index = 0; index < highestBid.length; index++) {
        const subCategoryId = highestBid[index].subCategoryId.toString();

        if (!subCategoryRanks[subCategoryId]) {
          const checkRank = await Bid.aggregate([
            {
              $match: {
                bidType: "featured",
                subCategoryId: new ObjectId(subCategoryId),
                biddingDate: new Date(biddingDate),
              },
            },
            {
              $sort: {
                amount: -1,
              },
            },
          ]);

          subCategoryRanks[subCategoryId] = checkRank.map((bid, i) => ({
            ...bid,
            rank: i + 1,
          }));
        }

        const userBid = subCategoryRanks[subCategoryId].find(
          (bid) => bid.sellerId.toString() === userId.toString()
        );

        highestBid[index].rank = userBid ? userBid.rank : null;
      }

      return success(res, i18n.__("FETCHDATA"), { highestBid });
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },

  HighestBidForAllProductFeatured: async (req, res) => {
    try {
      var requests = await decrypter(req.query);
      if (requests == false) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      const userId = new ObjectId(req.user._id);

      let query = {
        sellerId: userId,
        bidType: "featured",
      };

      let currentDate = new Date();
      const highestBid = await Product.aggregate([
        {
          $match: { isFeatured: true },
        },
        {
          $sort: {
            featureBidAmt: -1,
          },
        },
        {
          $limit: 10,
        },
        {
          $lookup: {
            from: "subcategories",
            localField: "subCategoryId",
            foreignField: "_id",
            as: "subcategory",
          },
        },
        {
          $lookup: {
            from: "bids",
            let: { productId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$productId", "$$productId"],
                  },
                },
              },
              {
                $count: "total", // Count the number of documents
              },
            ],
            as: "selfSubCats",
          },
        },
        {
          $addFields: {
            selfSubCatsCount: {
              $ifNull: [{ $arrayElemAt: ["$selfSubCats.total", 0] }, 0],
            },            subCategoryName: {
              _id: { $arrayElemAt: ["$subcategory._id", 0] },
              enName: { $arrayElemAt: ["$subcategory.enName", 0] },
              arName: { $arrayElemAt: ["$subcategory.arName", 0] },
            },
            productDetails: "$product",
          },
        },
        {
          $project: {
            _id: 1,
            subCategoryId: 1,
            subCategoryName: 1,
            sellerId: 1,
            name: 1,
            quantity: 1,
            productLocation: 1,
            unit: 1,
            price: 1,
            description: 1,
            isFeatured: 1,
            featureBidAmt:1,
            totalBids: "$selfSubCatsCount",
            rank:1,
            imageUrl: {
              $cond: {
                if: { $isArray: "$images.productImage" },
                then: {
                  $concat: [
                    process.env.AWS_URL,
                    {
                      $arrayElemAt: ["$images.productImage", 0],
                    },
                  ],
                },
                else: "",
              },
            },
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ]);
      return success(res, i18n.__("FETCHDATA"), { highestBid });
    } catch (error) {
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },

  // graphData: async (req, res) => {
  //   try {
  //     const requests = await decrypter(req.query);
  //     if (!requests) {
  //       return response(res, 500, i18n.__("Internal_Error"));
  //     }

  //     // Get the current year
  //     const currentYear = new Date().getFullYear();
  //     // Extract start date and end date from the request, or use default values for the current year if not provided
  //     const startDate = requests.startDate
  //       ? new Date(`${requests.startDate}T00:00:00.000Z`)
  //       : new Date(`${currentYear}-01-01T00:00:00.000Z`);
  //     const endDate = requests.endDate
  //       ? new Date(`${requests.endDate}T23:59:59.999Z`)
  //       : new Date(`${currentYear + 1}-01-01T00:00:00.000Z`);

  //     // Create the match criteria for the MongoDB aggregation pipeline
  //     const matchCriteria = {
  //       createdAt: { $gte: startDate, $lt: endDate },
  //     };

  //     if (requests.categoryId) {
  //       matchCriteria.categoryId = new ObjectId(requests.categoryId);
  //     }

  //     console.log("Match Criteria:", matchCriteria);

  //     // Aggregate orders by month and calculate total amount for each month
  //     const orderRevenue = await Order.aggregate([
  //       { $match: matchCriteria },
  //       {
  //         $group: {
  //           _id: { $month: "$createdAt" },
  //           totalAmount: { $sum: "$amount" },
  //         },
  //       },
  //       { $project: { _id: 0, month: "$_id", totalAmount: 1 } },
  //       { $sort: { month: 1 } },
  //     ]);

  //     console.log("Order Revenue:", orderRevenue);

  //     // Create an array to hold revenue data for each month
  //     const monthNames = [
  //       "January",
  //       "February",
  //       "March",
  //       "April",
  //       "May",
  //       "June",
  //       "July",
  //       "August",
  //       "September",
  //       "October",
  //       "November",
  //       "December",
  //     ];

  //     const revenueData = monthNames.map((month, index) => {
  //       const monthRevenue = orderRevenue.find(
  //         (item) => item.month === index + 1
  //       );
  //       return {
  //         month,
  //         totalAmount: monthRevenue ? monthRevenue.totalAmount : 0,
  //       };
  //     });

  //     // Aggregate orders by category and calculate total amount for the year for each category
  //     const categoryTotal = await Order.aggregate([
  //       { $match: matchCriteria },
  //       { $group: { _id: "$categoryId", totalAmount: { $sum: "$amount" } } },
  //     ]);

  //     // Calculate total amount for all subcategories
  //     const totalAmountAllSubcategories = categoryTotal.reduce(
  //       (acc, cur) => acc + cur.totalAmount,
  //       0
  //     );

  //     // Calculate total percentage of categories
  //     const totalPercentageOfCategories = categoryTotal.map((category) => ({
  //       categoryId: category._id,
  //       totalPercentage: Math.round(
  //         (category.totalAmount / totalAmountAllSubcategories) * 100
  //       ), // Round off to whole numbers
  //     })).filter(category => category.categoryId != null);

  //     const newData = { revenue: revenueData, totalPercentageOfCategories };

  //     return success(res, i18n.__("FETCHDATA"), { newData });
  //   } catch (error) {
  //     console.log("Error:", error);
  //     return serverError(res, 500, i18n.__("Internal_Error"));
  //   }
  // },
  graphData: async (req, res) => {
    try {
      const requests = await decrypter(req.query);
      if (!requests) {
        return response(res, 500, i18n.__("Internal_Error"));
      }
      const userId = new ObjectId(req.user._id);
      // Get the current year
      const currentYear = new Date().getFullYear();
      // Extract start date and end date from the request, or use default values for the current year if not provided
      const startDate = requests.startDate
        ? new Date(`${requests.startDate}T00:00:00.000Z`)
        : new Date(`${currentYear}-01-01T00:00:00.000Z`);
      const endDate = requests.endDate
        ? new Date(`${requests.endDate}T23:59:59.999Z`)
        : new Date(`${currentYear + 1}-01-01T00:00:00.000Z`);

      // Create the match criteria for the MongoDB aggregation pipeline
      const matchCriteria = {
        createdAt: { $gte: startDate, $lt: endDate },
        sellerId: userId,
        sellerOrderStatus: { $ne: "Cancelled" },
      };

      if (requests.categoryId) {
        matchCriteria.categoryId = new ObjectId(requests.categoryId);
      }

      console.log("Match Criteria:", matchCriteria);

      // Aggregate orders by month and category, and calculate total amount and total orders for each category in each month
      const orderRevenue = await Order.aggregate([
        { $match: matchCriteria },
        {
          $group: {
            _id: { month: { $month: "$createdAt" }, categoryId: "$categoryId" },
            totalAmount: { $sum: "$amount" },
            totalOrders: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            month: "$_id.month",
            categoryId: "$_id.categoryId",
            totalAmount: 1,
            totalOrders: 1,
          },
        },
        { $sort: { month: 1, categoryId: 1 } },
      ]);

      console.log("Order Revenue:", orderRevenue);

      // Create an array to hold revenue data for each month
      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];

      const revenueData = monthNames.map((month, index) => {
        const monthRevenue = orderRevenue.filter(
          (item) => item.month === index + 1
        );
        return {
          month,
          categories: monthRevenue.map((item) => ({
            categoryId: item.categoryId,
            totalAmount: item.totalAmount,
            totalOrders: item.totalOrders,
          })),
        };
      });

      // Aggregate orders by category and calculate total amount for the year for each category
      const categoryTotal = await Order.aggregate([
        { $match: matchCriteria },
        { $group: { _id: "$categoryId", totalAmount: { $sum: "$amount" } } },
      ]);

      // Calculate total amount for all subcategories
      const totalAmountAllSubcategories = categoryTotal.reduce(
        (acc, cur) => acc + cur.totalAmount,
        0
      );

      // Calculate total percentage of categories
      const totalPercentageOfCategories = categoryTotal
        .map((category) => ({
          categoryId: category._id,
          totalPercentage: Math.round(
            (category.totalAmount / totalAmountAllSubcategories) * 100
          ), // Round off to whole numbers
        }))
        .filter((category) => category.categoryId != null);

      const newData = { revenue: revenueData, totalPercentageOfCategories };

      return success(res, i18n.__("FETCHDATA"), { newData });
    } catch (error) {
      console.log("Error:", error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },
};
