const { Validator } = require("node-input-validator");
const FileUpload = require("../../../../../../services/upload-files");
const bcrypt = require("bcrypt");
const i18n = require("i18n");
const mongoose = require("mongoose");
const { ObjectId } = require("mongodb");
const Product = require("../../../../../Models/Product");
const Commission = require("../../../../../Models/Comission");
const User = require("../../../../../Models/User");
const Bid = require("../../../../../Models/Bid");
const Master = require("../../../../../Models/Master");
const moment = require("moment");

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
const { secondHighestBidder } = require("../seller/OrderController");

module.exports = {
  //Highest Bid for Product Auction Result Declare
  HighestMyBiddingForAnyProduct: async (req, res) => {
    try {
      // Decrypt the request body
      var requests = await decrypter(req.query);
      console.log(requests);
      if (requests === false) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      const user = await User.findOne({
        _id: new ObjectId(req.user._id),
      });

      if (!user) {
        return response(res, 422, i18n.__("NOTFOUND"));
      }

      let page = requests.page ? parseInt(requests.page) : 1;
      let pageSize = requests.limit ? parseInt(requests.limit) : 10;
      let skipIndex = (page - 1) * pageSize;
      let search = requests.search ? requests.search : "";
      let category = requests.category ? requests.category : "";
      let status = requests.status ? requests.status : "";

      let params = {
        userId: new ObjectId(user._id),
        bidType: "purchase", // Add condition for bidType
      };
      console.log(params, "sds");
      if (category && category !== "") {
        params["product.categoryId"] = new ObjectId(category);
      }

      var condition = {};
      // if (status && status !== '') {

      //     if (status === "won") {
      //         condition['$and'] = [
      //             { '$gt': ["$product.orderTimer", new Date()] },
      //             { '$eq': ["$highestBidAmount", "$amount"] }
      //         ];

      //     } else {
      //         condition['$lt'] = ["$myBidAmount", "$highestBidAmount"];

      //     }
      // }

      if (status && status !== "") {
        if (status === "won") {
          params = Object.assign(params, {
            bidStatus: "won",
          });
        } else {
          params = Object.assign(params, {
            $or: [
              {
                bidStatus: "missed",
              },
              {
                bidStatus: "loss",
              },
            ],
          });
        }
      }
      console.log(condition);
      // Add condition for orderTimer

      if (search && search != "") {
        console.log("dog");
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
            {
              "subCategory.enName": {
                $regex: searchnew,
                $options: "i",
              },
            },
            {
              "subCategory.arName": {
                $regex: searchnew,
                $options: "i",
              },
            },
          ],
        });
      }
      const today = new Date();
      const currentDate = moment(today).format("YYYY-MM-DD");
      console.log(params, "sdad");
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
        {
          $unwind: "$product",
        },
        {
          $match: {
            $expr: condition,
          },
        },
        {
          $match: {
            "product.endDate": {
              $lt: new Date(), // Compare endDate with the current date
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
        {
          $unwind: "$subCategory",
        },
        {
          $lookup: {
            from: "categories",
            localField: "subCategory.categoryId",
            foreignField: "_id",
            as: "category",
          },
        },
        {
          $unwind: "$category",
        },
        {
          $lookup: {
            from: "orders", // Assuming 'orders' is your collection name
            localField: "productId",
            foreignField: "productId", // Assuming 'bidId' links order to bid
            as: "orderDetails",
          },
        },
        {
          $unwind: {
            path: "$orderDetails",
            preserveNullAndEmptyArrays: true, // Important to keep bids without orders
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "product.sellerId", // Field to match in the products collection
            foreignField: "_id",
            as: "seller",
          },
        },
        {
          $unwind: "$seller",
        },
        {
          $match: params,
        },
        {
          $match: {
            "product.isDeleted": false,
            "product.status": true,
          },
        }, // Filter products
        {
          $addFields: {
            auctionStatus: {
              $switch: {
                branches: [
                  // Check if the bid amount is equal to the highest bid amount
                  {
                    case: {
                      $eq: ["$highestBidAmount", "$amount"],
                    },
                    then: {
                      $cond: [
                        {
                          $or: [
                            {
                              $ifNull: ["$orderDetails", false],
                            },
                            {
                              $gt: ["$product.orderTimer", new Date()],
                            }, // Check if the order timer is in the future
                          ],
                        },
                        "won", // If both conditions are met, set auction status to "Won"
                        "missed", // If any condition is not met, set auction status to "Missed"
                      ],
                    },
                  },
                  // Check if the bid amount is less than the highest bid amount
                  {
                    case: {
                      $lt: ["$amount", "$highestBidAmount"],
                    },
                    then: "loss",
                  },
                ],
                default: null, // Default value if none of the conditions are met
              },
            },
            statusOrder: {
              $switch: {
                branches: [
                  {
                    case: { $eq: ["$bidStatus", "won"] },
                    then: 1,
                  },
                  {
                    case: { $eq: ["$bidStatus", "loss"] },
                    then: 2,
                  },
                  {
                    case: { $eq: ["$bidStatus", "missed"] },
                    then: 3,
                  },
                ],
                default: 4, // Default value for other cases
              },
            },
          },
        },
        {
          $facet: {
            myBidData: [
              {
                $sort: {
                  statusOrder: 1, // Sort ascending by statusOrder
                  createdAt: -1,
                },
              },
              {
                $skip: skipIndex,
              },
              {
                $limit: pageSize,
              },
              {
                $project: {
                  highestBidAmount: 1,
                  orderPlaced: {
                    $cond: {
                      if: "$orderDetails",
                      then: true,
                      else: false,
                    },
                  },
                  status: 1,
                  bidStatus: 1,
                  myBidAmount: "$amount",
                  auctionStatus: 1,
                  productDetails: {
                    productId: "$product._id",
                    sellerId: "$product.sellerId",
                    userName: "$seller.userName",
                    name: "$seller.name",
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
                    orderTimer: "$product.orderTimer",
                    secondOrderTimer: "$product.secondOrderTimer",
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
              {
                $count: "count", // Count the total number of documents
              },
            ],
          },
        },
      ]);
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

  //Highest Pending Bids For Product
  HighestPendingBiddingForProducts: async (req, res) => {
    try {
      // Decrypt the request body
      var requests = await decrypter(req.query);
      if (requests === false) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      const user = await User.findOne({
        _id: new ObjectId(req.user._id),
      });

      if (!user) {
        return response(res, 422, i18n.__("NOTFOUND"));
      }

      let page = requests.page ? parseInt(requests.page) : 1;
      let pageSize = requests.limit ? parseInt(requests.limit) : 10;
      let skipIndex = (page - 1) * pageSize;
      let search = requests.search ? requests.search : "";
      let category = requests.category ? requests.category : "";
      // let timeRange = requests.timeRange ? requests.timeRange : '';

      let params = {
        userId: new ObjectId(req.user._id),
        bidType: "purchase", // Add condition for bidType
        // isDeleted: false
        // status: true,
      };
      console.log(params, "sds");
      if (category && category != "") {
        params.categoryId = new ObjectId(category);
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
            {
              "subCategory.enName": {
                $regex: searchnew,
                $options: "i",
              },
            },
            {
              "subCategory.arName": {
                $regex: searchnew,
                $options: "i",
              },
            },
          ],
        });
      }
      const today = new Date();
      const currentDate = moment(today).format("YYYY-MM-DD");
      const currentTime = moment().format("HH:mm");
      console.log(currentDate, "params", params);
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
        {
          $unwind: "$product",
        },
        {
          $match: {
            "product.endDate": {
              $gt: new Date(),
            }, // End date is greater than current date
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
        {
          $unwind: "$subCategory",
        },
        {
          $lookup: {
            from: "users",
            localField: "product.sellerId", // Field to match in the products collection
            foreignField: "_id",
            as: "seller",
          },
        },
        {
          $unwind: "$seller",
        },
        {
          $match: params,
        },
        {
          $match: {
            "product.isDeleted": false,
            "product.status": true,
          },
        }, // Filter products
        {
          $facet: {
            myBidData: [
              {
                $sort: {
                  createdAt: -1,
                },
              },
              {
                $skip: skipIndex,
              }, // Skip documents based on pagination
              {
                $limit: pageSize,
              }, // Limit the number of documents based on pagination
              {
                $project: {
                  highestBidAmount: 1,
                  myBidAmount: "$amount",
                  status: 1,
                  bidStatus: 1,
                  auctionStatus: {
                    $cond: [
                      {
                        $and: [
                          {
                            $eq: ["$highestBidAmount", "$amount"],
                          },
                          {
                            $lt: ["$product.endDate", new Date()],
                          },
                        ],
                      },
                      "won",
                      {
                        $cond: [
                          {
                            $and: [
                              {
                                $ne: ["$amount", null],
                              },
                              {
                                $lt: ["$amount", "$highestBidAmount"],
                              },
                              {
                                $lt: ["$product.endDate", new Date()],
                              },
                            ],
                          },
                          "loss",
                          {
                            $cond: [
                              {
                                $and: [
                                  {
                                    $gt: ["$orderTimer", new Date()],
                                  },
                                  {
                                    $eq: ["$amount", "$highestBidAmount"],
                                  },
                                  {
                                    $gt: ["$product.endDate", new Date()],
                                  },
                                ],
                              },
                              "missed",
                              "pending",
                            ],
                          },
                        ],
                      },
                    ],
                  },
                  productDetails: {
                    productId: "$product._id",
                    sellerId: "$product.sellerId",
                    userName: "$seller.userName",
                    name: "$seller.name",
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
                        if: {
                          $isArray: "$product.images",
                        },
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
                  },
                },
              },
            ],
            totalCount: [
              {
                $count: "count",
              }, // Count the total number of documents
            ],
          },
        },
      ]);

      // console.log({highestBids}, {myBids})
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

  biddingDetails: async (req, res) => {
    try {
      // Decrypt the request body
      var requests = await decrypter(req.query);
      if (requests === false) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      // Validate the request parameters
      const v = new Validator(requests, {
        bidId: "required",
      });

      const matched = await v.check();
      if (!matched) {
        return failedValidation(res, v);
      }

      // Aggregate pipeline to fetch bidding details with product and user data
      let biddingDetails = await Bid.aggregate([
        {
          $match: {
            _id: new ObjectId(requests.bidId),
          },
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
          $lookup: {
            from: "users",
            localField: "product.sellerId",
            foreignField: "_id",
            as: "seller",
          },
        },

        {
          $unwind: "$seller",
        },
        {
          $lookup: {
            from: "subcategories",
            localField: "product.subCategoryId",
            foreignField: "_id",
            as: "subCategory",
          },
        },
        {
          $unwind: "$subCategory",
        },
        {
          $lookup: {
            from: "categories",
            localField: "subCategory.categoryId",
            foreignField: "_id",
            as: "category",
          },
        },
        {
          $unwind: "$category",
        },
        {
          $lookup: {
            from: "orders", // Assuming 'orders' is your collection name
            let: { productId: "$productId" },
            pipeline: [
              { $match: { $expr: { $eq: ["$productId", "$$productId"] } } },
              { $sort: { createdAt: -1 } },
              { $limit: 1 },
            ],
            as: "orderDetails",
          },
        },
        {
          $unwind: {
            path: "$orderDetails",
            preserveNullAndEmptyArrays: true, // Important to keep bids without orders
          },
        },

        {
          $project: {
            bid: {
              _id: "$_id",
              productId: "$productId",
              userId: "$userId",
              highestBidAmount: "$highestBidAmount",
              myBidAmount: "$amount",
              status: "$status",
              bidStatus: "$bidStatus",
              biddingDate: "$createdAt",
              assignSecondHighestBidder: "$assignSecondHighestBidder",
              orderPlaced: {
                $cond: {
                  if: "$orderDetails",
                  then: true,
                  else: false,
                },
              },
              orderId: "$orderDetails._id", // Include or exclude based on your preference
              // auctionStatus: {
              //     $cond: {
              //         if: { $gte: ["$product.endDate", new Date()] },
              //         then: "pending",
              //         else: {
              //             $cond: {
              //                 if: {
              //                     $and: [
              //                         { $lt: ["$product.endDate", new Date()] },
              //                         { $eq: ["$highestBidAmount", "$amount"] },
              //                         { $gt: ["$product.orderTimer", new Date()] },
              //                         { $ifNull: ["$orderDetails", false] }
              //                     ]
              //                 },
              //                 then: "won",
              //                 else: {
              //                     $cond: {
              //                         if: {
              //                             $and: [
              //                                 { $lt: ["$product.endDate", new Date()] },
              //                                 { $eq: ["$highestBidAmount", "$amount"] },
              //                                 { $lte: ["$product.orderTimer", new Date()] },
              //                                 { $ifNull: ["$orderDetails", true] } // New condition for missed status
              //                             ]
              //                         },
              //                         then: "missed",
              //                         else: {
              //                             $cond: {
              //                                 if: {
              //                                     $and: [
              //                                         { $lt: ["$product.endDate", new Date()] },
              //                                         { $lt: ["$amount", "$highestBidAmount"] }
              //                                     ]
              //                                 },
              //                                 then: "loss",
              //                                 else: {
              //                                     $cond: {
              //                                         if: {
              //                                             $and: [
              //                                                 { $ne: ["$amount", null] },
              //                                                 { $eq: ["$amount", "$secondHighestBidAmount"] }
              //                                             ]
              //                                         },
              //                                         then: "unfilled",
              //                                         else: "pending"
              //                                     }
              //                                 }
              //                             }
              //                         }
              //                     }
              //                 }
              //             }
              //         }
              //     }
              // }
              auctionStatus: {
                $switch: {
                  branches: [
                    // Check if the bid amount is equal to the highest bid amount
                    {
                      case: {
                        $eq: ["$highestBidAmount", "$amount"],
                      },
                      then: {
                        $cond: {
                          if: {
                            $and: [
                              {
                                $lt: ["$product.endDate", new Date()],
                              },
                              {
                                $lt: ["$product.orderTimer", new Date()],
                              },
                              {
                                $ifNull: ["$orderDetails", false],
                              },
                            ],
                          },
                          then: "won", // If all conditions are met, set auction status to "Won"
                          else: {
                            $cond: {
                              if: {
                                $gt: ["$product.endDate", new Date()],
                              },
                              then: "missed", // If the end date is in the past, set auction status to "Missed"
                              else: "pending", // Otherwise, set it to "Pending"
                            },
                          },
                        },
                      },
                    },
                    // Check if the bid amount is less than the highest bid amount
                    {
                      case: {
                        $lt: ["$amount", "$highestBidAmount"],
                      },
                      then: "loss",
                    },
                  ],
                  default: null, // Default value if none of the conditions are met
                },
              },

              // Include additional bid fields as needed
            },
            product: {
              _id: "$product._id",
              sellerId: "$product.sellerId",
              userName: "$seller.userName",
              name: "$seller.name",
              quantity: "$product.quantity",
              unit: "$product.unit",
              productPrice: "$product.price",
              description: "$product.description",
              mobile: "$product.mobile",
              countryCode: "$product.countryCode",
              productLocation: "$product.productLocation",
              startDate: "$product.startDate",
              endDate: "$product.endDate",
              orderTimer: "$product.orderTimer",
              secondOrderTimer: "$product.secondOrderTimer",
              startTime: "$product.startTime",
              endTime: "$product.endTime",
              status: "$product.status",
              isDeleted: "$product.isDeleted",
              createdAt: "$product.createdAt",
              updatedAt: "$product.updatedAt",
              imageUrl: {
                $cond: {
                  if: {
                    $isArray: "$product.images",
                  },
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
      ]);

      if (!biddingDetails || biddingDetails.length === 0) {
        return response(res, 404, i18n.__("Bid_not_found"));
      }
      const masterData = await Master.findOne({});
      biddingDetails = biddingDetails[0];
      const data = await Commission.find();

      // biddingDetails.bid.vatAmount = masterData.vatAmount;
      const vatAmt = (biddingDetails.bid.myBidAmount * data[0].vat) / 100;
      biddingDetails.bid.vatAmount = vatAmt;

      biddingDetails.bid.payableAmount =
        vatAmt + biddingDetails.bid.myBidAmount;
      // biddingDetails.bid.payableAmount = biddingDetails.bid.myBidAmount;
      // console.log(
      //   "biddingDetails.bid.assignSecondHighestBidder",
      //   biddingDetails.bid.assignSecondHighestBidder
      // );
      if (biddingDetails.bid.assignSecondHighestBidder == true) {
        biddingDetails.bid.remainingAmount = Math.round(biddingDetails.bid.payableAmount * 10) / 10;
      } else {
        biddingDetails.bid.remainingAmount = Math.round((biddingDetails.bid.payableAmount - biddingDetails.bid.myBidAmount) * 10) / 10;
      }
      

      return success(res, i18n.__("FETCHDATA"), biddingDetails);
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },

  checkOrderPlaced: async (req, res) => {
    try {
      var requests = await decrypter(req.query);
      if (requests === false) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      // Validate the request parameters
      const v = new Validator(requests, {
        bidId: "required",
      });

      const matched = await v.check();
      if (!matched) {
        return failedValidation(res, v);
      }
      let biddingDetails = await Bid.aggregate([
        {
          $match: {
            _id: new ObjectId(requests.bidId),
          },
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
          $lookup: {
            from: "users",
            localField: "product.sellerId",
            foreignField: "_id",
            as: "seller",
          },
        },

        {
          $unwind: "$seller",
        },
        {
          $lookup: {
            from: "subcategories",
            localField: "product.subCategoryId",
            foreignField: "_id",
            as: "subCategory",
          },
        },
        {
          $unwind: "$subCategory",
        },
        {
          $project: {
            bid: {
              _id: "$_id",
              productId: "$productId",
              userId: "$userId",
              highestBidAmount: "$highestBidAmount",
              myBidAmount: "$amount",
              biddingDate: "$createdAt",
              auctionStatus: {
                $cond: {
                  if: {
                    $gte: ["$orderTimer", new Date()],
                  }, // Assuming endDate is available in product
                  then: "unfilled",
                  else: {
                    $cond: {
                      if: {
                        $eq: ["$highestBidAmount", "$amount"],
                      },
                      then: "won",
                      else: {
                        $cond: {
                          if: {
                            $and: [
                              {
                                $ne: ["$amount", null],
                              },
                              {
                                $lt: ["$amount", "$highestBidAmount"],
                              },
                            ],
                          },
                          then: "loss",
                          else: "pending",
                        },
                      },
                    },
                  },
                },
              },

              // Include additional bid fields as needed
            },
            product: {
              _id: "$product._id",
              sellerId: "$product.sellerId",
              userName: "$seller.userName",
              name: "$seller.name",
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
                  if: {
                    $isArray: "$product.images",
                  },
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
            },
          },
        },
      ]);

      if (!biddingDetails || biddingDetails.length === 0) {
        return response(res, 404, i18n.__("Bid_not_found"));
      }
      // const masterData = await Master.findOne({})
      // biddingDetails = biddingDetails[0]
      // biddingDetails.bid.vatAmount = masterData?.vatAmount
      // biddingDetails.bid.payableAmount = (masterData?.vatAmount + biddingDetails?.bid?.myBidAmount)
      return success(res, i18n.__("FETCHDATA"), biddingDetails);
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },

  // secondHighestBidderReject: async() => {
  //     try {
  //         var requests = await decrypter(req.query);
  //         if (requests === false) {
  //             return response(res, 500, i18n.__('Internal_Error'));
  //         }

  //         // Validate the request parameters
  //         const v = new Validator(requests, {
  //             'bidId': 'required',
  //         });

  //     return success(res, i18n.__('FETCHDATA'), biddingDetails);
  // } catch (error) {
  //     console.error(error);
  //     return serverError(res, 500, i18n.__('Internal_Error'));

  // }
};
