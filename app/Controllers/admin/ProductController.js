const { Validator } = require("node-input-validator");
const Product = require("../../../app/Models/Product");
const User = require("../../../app/Models/User");
const SubCategory = require("../../../app/Models/SubCategory");
const Category = require("../../../app/Models/Category");
const Bid = require("../../../app/Models/Bid");
const response = require("../../../helper/helper");
const FileUpload = require("../../../services/upload-files");
const mongoose = require("mongoose");
const { ObjectId } = require("mongodb");
const {
  serverError,
  validateFail,
  failed,
  success,
} = require("../../../helper/helper");
const moment = require("moment");

module.exports = {
  getProducts: async (req, res) => {
    try {
      let {
        page = 1,
        pageSize = 10,
        search = "",
        category = "",
        startDate,
        endDate,
        sortBy,
      } = req.query;
      page = parseInt(page);
      pageSize = parseInt(pageSize);
      const skipIndex = (page - 1) * pageSize;

      const params = { isDeleted: false };

      if (category && category !== "") {
        params.categoryId = new ObjectId(category);
      }

      if (startDate && endDate) {
        params.createdAt = {
          $gte: new Date(startDate + " 00:00:00"),
          $lte: new Date(endDate + " 23:59:00"),
        };
      }

      // Define sorting options
      let sortOptions = { createdAt: -1 }; // Default sorting by createdAt in descending order

      if (sortBy == 1) {
        // oldest to newest
        sortOptions = { createdAt: 1 };
      } else if (sortBy == 2) {
        // newest to oldest
        sortOptions = { createdAt: -1 };
      } else if (sortBy == 3) {
        // a to z at first
        sortOptions = { "subCategoryDetails.enName": 1 };
      } else if (sortBy == 4) {
        // z to a at last
        sortOptions = { "subCategoryDetails.enName": -1 };
      }

      let products = await Product.aggregate([
        {
          $match: params,
        },
        {
          $lookup: {
            from: "users",
            let: {
              sellerId: "$sellerId",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$_id", "$$sellerId"],
                  },
                },
              },
              {
                $project: {
                  userName: 1,
                },
              },
            ],
            as: "sellerDetails",
          },
        },
        {
          $unwind: {
            path: "$sellerDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "subcategories",
            let: {
              subCategoryId: "$subCategoryId",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$_id", "$$subCategoryId"],
                  },
                },
              },
              {
                $project: {
                  enName: 1,
                  arName: 1,
                },
              },
            ],
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
            from: "bids",
            let: { productId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$productId", "$$productId"] },
                },
              },
              {
                $group: {
                  _id: "$productId",
                  highestBid: { $max: "$amount" },
                },
              },
            ],
            as: "bidDetails",
          },
        },
        {
          $unwind: {
            path: "$bidDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $match: {
            $or: [
              {
                "subCategoryDetails.enName": {
                  $regex: new RegExp("^" + search.substring(0, 3), "i"),
                },
              },
              {
                "subCategoryDetails.arName": {
                  $regex: new RegExp("^" + search.substring(0, 3), "i"),
                },
              },
            ],
          },
        },
        //
        {
          $project: {
            quantity: 1,
            sellerDetails: 1,
            subCategoryDetails: 1,
            unit: 1,
            price: 1,
            description: 1,
            mobile: 1,
            countryCode: 1,
            productLocation: 1,
            startDate: 1,
            endDate: 1,
            startTime: 1,
            endTime: 1,
            status: 1,
            isDeleted: 1,
            createdAt: 1,
            updatedAt: 1,
            imageUrl: {
              $cond: {
                if: { $isArray: "$images" },
                then: {
                  $concat: [
                    process.env.AWS_URL,
                    { $arrayElemAt: ["$images.productImage", 0] },
                  ],
                },
                else: "",
              },
            },
            highestBid: { $ifNull: ["$bidDetails.highestBid", 0] },
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

      console.log("sds", products);

      const totalItems = await Product.countDocuments(params);

      return success(res, "Products fetched successfully!", {
        products,
        totalItems,
      });
    } catch (error) {
      console.error(error);
      return serverError(res, "Internal Server Error");
    }
  },

  getProductSingleDetails: async (req, res) => {
    try {
      const productId = req.query.id;
      const currentDate = new Date();

      const product = await Product.findById(productId);
      if (!product) {
        return failed(res, "Product not found.", {});
      }

      let { page = 1, pageSize = 10 } = req.query;
      page = parseInt(page);
      pageSize = parseInt(pageSize);
      const skipIndex = (page - 1) * pageSize;

      // Fetch categories, subcategories, seller, and highest bid
      const [category, subcategory, seller, highestBid] = await Promise.all([
        Category.findById(product.categoryId),
        SubCategory.findById(product.subCategoryId),
        User.findById(product.sellerId),
        Bid.find({ productId: new ObjectId(productId) })
          .sort({ biddingDate: -1, amount: -1 })
          .limit(1),
      ]);

      const isFeatured = highestBid.length > 0;
      const bidList = await Bid.aggregate([
        {
          $match: { productId: new ObjectId(productId) },
        },
        {
          $lookup: {
            from: "users",
            foreignField: "_id",
            localField: "userId",
            as: "userDetail",
          },
        },
        {
          $unwind: "$userDetail",
        },
        {
          $sort: { biddingDate: -1, amount: -1 },
        },
        {
          $project: {
            _id: 1,
            bidType: 1,
            amount: 1,
            highestBidAmount: 1,
            bidStatus: 1,
            "userDetail.userName": 1,
          },
        },
        { $skip: skipIndex },
        { $limit: pageSize },
      ]);
      console.log({ skipIndex });
      console.log({ pageSize });
      console.log({ page });
 

      let featuredBiddingDates = "";

      if (isFeatured) {
        if (Array.isArray(highestBid)) {
          const biddingDates = highestBid.map((bid) => bid.biddingDate);
          featuredBiddingDates = biddingDates;
        } else {
          featuredBiddingDates = highestBid ? highestBid.biddingDate : "";
        }
      }

      const productDetails = {
        _id: product._id,
        name: product.name,
        description: product.description,
        quantity: product.quantity,
        unit: product.unit,
        price: product.price,
        mobile: product.mobile,
        countryCode: product.countryCode,
        productLocation: product.productLocation,
        startDate: product.startDate,
        endDate: product.endDate,
        startTime: product.startTime,
        endTime: product.endTime,
        status: product.status,
        isDeleted: product.isDeleted,
        createdAt: product.createdAt,
        imageUrl: product.imageUrl,
        category: category
          ? {
              _id: category._id,
              enName: category.enName,
              arName: category.arName,
            }
          : null,
        subcategory: subcategory
          ? {
              _id: subcategory._id,
              enName: subcategory.enName,
              arName: subcategory.arName,
            }
          : null,
        seller: seller
          ? {
              _id: seller._id,
              userName: seller.userName,
            }
          : null,
        isFeatured: isFeatured,
        featuredBiddingDates: isFeatured ? featuredBiddingDates : null,
        bidList,
        bidListCount: bidList.length,
      };

      return success(res, "Product fetched successfully!", productDetails);
    } catch (error) {
      console.error(error);
      return serverError(res, "Internal Server Error");
    }
  },

  statusChange: async (req, res) => {
    try {
      const v = new Validator(req.body, {
        status: "required",
        productId: "required",
      });

      const matched = await v.check();
      if (!matched) {
        return validateFail(res, v);
      }

      const { status, productId } = req.body;

      const product = await Product.findById(productId);
      if (!product) {
        return failed(res, "Product not found.", {});
      }

      // Update the user status
      product.status = status;
      await product.save();

      return success(res, "Product status updated successfully!", product);
    } catch (error) {
      console.error(error);
      return serverError(res, "Internal Server Error");
    }
  },

  productDeleted: async (req, res) => {
    try {
      const v = new Validator(req.body, {
        productId: "required",
      });

      const matched = await v.check();
      if (!matched) {
        return validateFail(res, v);
      }

      const { productId } = req.body;

      const product = await Product.findById(productId);
      if (!product) {
        return failed(res, "Product not found.", {});
      }

      // Update the user status
      product.isDeleted = true;
      await product.save();

      return success(res, "Product deleted successfully!", product);
    } catch (error) {
      console.error(error);
      return serverError(res, "Internal Server Error");
    }
  },
};
