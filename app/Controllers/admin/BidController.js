const { Validator } = require("node-input-validator");
const {
  serverError,
  success,
  failed,
  validateFail,
} = require("../../../helper/helper");
const Bids = require("../../Models/Bid");
const { ObjectId } = require("mongodb");
module.exports = {
  bidList: async (req, res) => {
    try {
      let {
        page = 1,
        pageSize = 10,
        search = "",
        startDate,
        endDate,
        sortBy,
        type,
      } = req.query;
      page = parseInt(page);
      pageSize = parseInt(pageSize);
      const params = { bidType: type };

      const skipIndex = (page - 1) * pageSize;
      if (startDate && endDate) {
        params.createdAt = {
          $gte: new Date(startDate + " 00:00:00"),
          $lte: new Date(endDate + " 23:59:00"),
        };
      }
      let sortOptions = { createdAt: -1 };
      if (sortBy == 1) {
        sortOptions = { createdAt: 1 };
      } else if (sortBy == 2) {
        sortOptions = { createdAt: -1 };
      } else if (sortBy == 3) {
        // a to z at first
        sortOptions = { "subcategoriesDetails.enName": 1 };
      } else if (sortBy == 4) {
        // z to a at last
        sortOptions = { "subcategoriesDetails.enName": -1 };
      }
      const bids = await Bids.aggregate([
        {
          $match: params,
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
          $unwind: "$productDetails",
        },
        {
          $lookup: {
            from: "users",
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
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "bidderDetails",
          },
        },
        {
          $unwind: "$bidderDetails",
        },
        {
          $lookup: {
            from: "subcategories",
            localField: "subCategoryId",
            foreignField: "_id",
            as: "subcategoriesDetails",
          },
        },
        {
          $unwind: "$subcategoriesDetails",
        },
        {
          $lookup: {
            from: "categories",
            localField: "subcategoriesDetails.categoryId",
            foreignField: "_id",
            as: "categoriesDetails",
          },
        },
        {
          $unwind: "$categoriesDetails",
        },
        {
          $match: {
            $or: [
              {
                "subcategoriesDetails.enName": {
                  $regex: new RegExp("^" + search.substring(0, 3), "i"),
                },
              },
              {
                "subcategoriesDetails.arName": {
                  $regex: new RegExp("^" + search.substring(0, 3), "i"),
                },
              },
              {
                "sellerDetails.userName": {
                  $regex: new RegExp("^" + search.substring(0, 3), "i"),
                },
              },
              {
                "bidderDetails.userName": {
                  $regex: new RegExp("^" + search.substring(0, 3), "i"),
                },
              },
            ],
          },
        },
        {
          $project: {
            _id: 1,
            sellerId: 1,
            subCategoryId: 1,
            productId: 1,
            bidType: 1,
            amount: 1,
            highestBidAmount: 1,
            biddingDate: 1,
            createdAt: 1,
            bidStatus: 1,
            "productDetails.productImage": {
              $concat: [
                process.env.AWS_URL,
                { $arrayElemAt: ["$productDetails.images.productImage", 0] },
              ],
            },
            "productDetails._id": 1,
            "productDetails.sellerId": 1,
            "productDetails.unit": 1,
            "productDetails.quantity": 1,
            "productDetails.productLocation": 1,
            "sellerDetails.userName": 1,
            "bidderDetails.userName": 1,
            "subcategoriesDetails.enName": 1,
            "categoriesDetails.enName": 1,
          },
        },
        {
          $sort: sortOptions,
        },
        {
          $skip: skipIndex,
        },
        {
          $limit: pageSize,
        },
      ]);
      let totalItems = await Bids.aggregate([
        {
          $match: params,
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
          $unwind: "$productDetails",
        },
        {
          $lookup: {
            from: "users",
            localField: "sellerId",
            foreignField: "_id",
            as: "userDetails",
          },
        },
        {
          $unwind: "$userDetails",
        },
        {
          $lookup: {
            from: "subcategories",
            localField: "subCategoryId",
            foreignField: "_id",
            as: "subcategoriesDetails",
          },
        },
        {
          $unwind: "$subcategoriesDetails",
        },
        {
          $lookup: {
            from: "categories",
            localField: "subcategoriesDetails.categoryId",
            foreignField: "_id",
            as: "categoriesDetails",
          },
        },
        {
          $unwind: "$categoriesDetails",
        },
        {
          $match: {
            $or: [
              {
                "subcategoriesDetails.enName": {
                  $regex: new RegExp("^" + search.substring(0, 3), "i"),
                },
              },
              {
                "subcategoriesDetails.arName": {
                  $regex: new RegExp("^" + search.substring(0, 3), "i"),
                },
              },
              {
                "userDetails.userName": {
                  $regex: new RegExp("^" + search.substring(0, 3), "i"),
                },
              },
            ],
          },
        },

        {
          $sort: sortOptions,
        },
      ]);
      totalItems = totalItems.length;
      console.log(totalItems.length);

      return success(res, "Bids listed successfully!", { bids, totalItems });
    } catch (error) {
      console.log({ error });
      return serverError(res, "Internal server error");
    }
  },
  bidDetails: async (req, res) => {
    try {
      const validate = new Validator(req.query, {
        id: "required",
      });
      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }

      const bidId = new ObjectId(req.query.id);
      const params = { _id: bidId };

      const bids = await Bids.aggregate([
        {
          $match: params,
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
          $unwind: "$productDetails",
        },
        {
          $lookup: {
            from: "users",
            localField: "sellerId",
            foreignField: "_id",
            as: "userDetails",
          },
        },
        {
          $unwind: "$userDetails",
        },
        {
          $lookup: {
            from: "subcategories",
            localField: "subCategoryId",
            foreignField: "_id",
            as: "subcategoriesDetails",
          },
        },
        {
          $unwind: "$subcategoriesDetails",
        },
        {
          $project: {
            _id: 1,
            sellerId: 1,
            subCategoryId: 1,
            productId: 1,
            bidType: 1,
            amount: 1,
            highestBidAmount: 1,
            biddingDate: 1,
            createdAt: 1,
            status: 1,
            "productDetails.productImage": {
              $concat: [
                process.env.AWS_URL,
                { $arrayElemAt: ["$productDetails.images.productImage", 0] },
              ],
            },
            "productDetails._id": 1,
            "productDetails.sellerId": 1,
            "productDetails.images": 1,
            "productDetails.quantity": 1,
            "productDetails.unit": 1,
            "productDetails.productLocation": 1,
            "userDetails.userName": 1,
            "subcategoriesDetails.enName": 1,
          },
        },
      ]);

      const productIds = bids.map((bid) => bid.productId);
      console.log({ productIds });
      // const highestBids = await Bids.aggregate([
      //   {
      //     $match: {
      //       productId: { $in: productIds },
      //       bidType: "featured",
      //     },
      //   },

      // ]);
      //     $match: {
      //       productId: { $in: productIds },
      //       bidType: "featured",
      //     },
      //   },
      console.log("productIds",productIds)
      const pipeline = [
        {
          $match: {
            productId: { $in: productIds },
          },
        },
        {
          $sort: {
            amount: -1, // Sort bids by amount in descending order
          },
        },
        {
          $group: {
            _id: "$subCategoryId",
            highestBid: { $first: "$$ROOT" }, // Get the first bid document for each subCategoryId
          },
        },
        {
          $replaceRoot: { newRoot: "$highestBid" }, // Replace the root with the highest bid document
        },
        {
          $lookup: {
            from: "subcategories",
            localField: "subCategoryId",
            foreignField: "_id",
            as: "subCategoryName",
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
          $lookup: {
            from: "products",
            localField: "productId",
            foreignField: "_id",
            as: "productDetails",
          },
        },
        {
          $addFields: {
            userName: { $arrayElemAt: ["$user.userName", 0] },
            subCategoryName: {
              $cond: {
                if: { $isArray: "$subCategoryName" },
                then: {
                  _id: { $arrayElemAt: ["$subCategoryName._id", 0] },
                  enName: { $arrayElemAt: ["$subCategoryName.enName", 0] },
                  arName: { $arrayElemAt: ["$subCategoryName.arName", 0] },
                },
                else: null,
              },
            },
            productDetails: { $arrayElemAt: ["$productDetails", 0] },
            isBid: false, // Assuming this field should be false for the highest bid
          },
        },
        {
          $project: {
            _id: 1,
            userId: 1,
            subCategoryId: 1,
            productId: 1,
            bidType: 1,
            amount: 1,
            biddingDate: 1,
            createdAt: 1,
            updatedAt: 1,
            subCategoryName: 1,
            userName: 1,
            status: 1,
            productDetails: {
              _id: 1,
              sellerId: 1,
              quantity: 1,
              unit: 1,
              price: 1,
              description: 1,
              productLocation: 1,
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
            isBid: 1,
          },
        },
      ];

      // Execute the aggregation pipeline
      const highestBid = await Bids.aggregate(pipeline);

      const newData = {
        bids: bids[0],
        highestBid,
      };

      return success(res, "Bid data fetched successfully!", newData);
    } catch (error) {
      console.error("Error:", error);
      return serverError(res, "Internal server error");
    }
  },
};
