const { Validator } = require("node-input-validator");
const FileUpload = require("../../../../../../services/upload-files");
const bcrypt = require("bcrypt");
const i18n = require("i18n");
const mongoose = require("mongoose");
const { ObjectId } = require("mongodb");
const Product = require("../../../../../Models/Product");
const Category = require("../../../../../Models/Category");
const User = require("../../../../../../app/Models/User");
const WishList = require("../../../../../Models/WishList");
const SubCategory = require("../../../../../Models/SubCategory");
const ReviewRating = require("../../../../../Models/ReviewRating");
const Bid = require("../../../../../Models/Bid");
const searchHistory = require("../../../../../Models/SearchHistory");
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
// Function to save search history
const saveSearchHistory = async (userId, productName) => {
  try {
    const history = new searchHistory({
      userId: userId,
      productName: productName,
    });
    await history.save();
  } catch (err) {
    console.error(err);
  }
};
module.exports = {
  // Product listing API with search and filter by category
  getProductsWithFilter: async (req, res) => {
    try {
      // Decrypt request query parameters
      var requests = await decrypter(req.query);
      if (requests === false) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      // Extract request parameters or set defaults
      let page = requests.page ? parseInt(requests.page) : 1;
      let pageSize = requests.limit ? parseInt(requests.limit) : 10;
      let skipIndex = (page - 1) * pageSize;
      let search = requests.search ? requests.search : "";
      let category = requests.category ? requests.category : "";
      // let address = requests.address ? requests.address : '';
      let price = requests.price ? parseInt(requests.price) : 1;
      let remainingHours = requests.remainingHours
        ? parseInt(requests.remainingHours)
        : "";

      // Define search parameters for products
      let params = {
        sellerId: {
          $ne: new ObjectId(req.user._id),
        },
        isDeleted: false,
        status: true,
        startDate: {
          $lte: new Date(),
        },
        endDate: {
          $gte: new Date(),
        },
      };
      if (price && price != 1) {
        params.price = {
          $lte: price,
        };
      }
      if (remainingHours && remainingHours != "") {
        // Calculate the current time and the time 7 hours ago
        const currentTime = new Date();
        const timeThreshold = new Date(
          currentTime.getTime() + remainingHours * 60 * 60 * 1000
        );
        params.endDate = {
          $lte: timeThreshold,
          $gte: currentTime,
        };
      }

      if (category && category != "") {
        params.categoryId = new ObjectId(category);
      }
      // if (address && address != '') {
      //     params.productLocation = address;
      // }
      if (search && search != "") {
        const regex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/g;
        // Use the replace() function to remove the special characters
        if (search.match(regex)) {
          return success(res, i18n.__("FETCHDATA"), {
            products: [],
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
      console.log("++++++++", req.user._id);

      // Aggregate query to get products and total count using $facet
      const result = await Product.aggregate([
        {
          $lookup: {
            from: "categories",
            localField: "categoryId",
            foreignField: "_id",
            as: "category",
          },
        },
        {
          $lookup: {
            from: "subcategories",
            localField: "subCategoryId",
            foreignField: "_id",
            as: "subCategory",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "sellerId",
            foreignField: "_id",
            as: "seller",
          },
        },
        {
          $match: {
            ...params,
            "seller.status": true,
          },
        },
        {
          $lookup: {
            from: "wishlists",
            let: {
              productId: "$_id",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      {
                        $eq: ["$userId", new ObjectId(req.user._id)],
                      },
                      {
                        $in: ["$$productId", "$products.productId"],
                      },
                    ],
                  },
                },
              },
              {
                $limit: 1,
              },
            ],
            as: "wishlist",
          },
        },
        {
          $lookup: {
            from: "bids",
            let: {
              productId: "$_id",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      {
                        $eq: ["$productId", "$$productId"],
                      },
                      {
                        $eq: ["$userId", new ObjectId(req.user._id)],
                      },
                    ],
                  },
                },
              },
              {
                $limit: 1,
              },
            ],
            as: "userBids",
          },
        },
        {
          $lookup: {
            from: "bids",
            localField: "_id",
            foreignField: "productId",
            as: "allBids",
          },
        },
        {
          $addFields: {
            bidCount: { $size: "$allBids" },
          },
        },
        {
          $sort: {
            isFeatured: -1, // First sort by isFeatured
            createdAt: -1, // Then sort by createdAt
          },
        },
        {
          $facet: {
            products: [
              {
                $skip: skipIndex,
              },
              {
                $limit: pageSize,
              },
              {
                $project: {
                  _id: 1,
                  sellerId: 1,
                  quantity: 1,
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
                  isFeatured: 1,
                  imageUrl: {
                    $cond: {
                      if: {
                        $isArray: "$images",
                      },
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
                  categoryId: {
                    _id: {
                      $arrayElemAt: ["$category._id", 0],
                    },
                    enName: {
                      $arrayElemAt: ["$category.enName", 0],
                    },
                    arName: {
                      $arrayElemAt: ["$category.arName", 0],
                    },
                  },
                  subCategoryId: {
                    _id: {
                      $arrayElemAt: ["$subCategory._id", 0],
                    },
                    enName: {
                      $arrayElemAt: ["$subCategory.enName", 0],
                    },
                    arName: {
                      $arrayElemAt: ["$subCategory.arName", 0],
                    },
                  },
                  isWishlist: {
                    $gt: [
                      {
                        $size: "$wishlist",
                      },
                      0,
                    ],
                  },
                  hasUserBid: {
                    $gt: [
                      {
                        $size: "$userBids",
                      },
                      0,
                    ],
                  },
                  bidCount: 1,
                },
              },
            ],
            totalCount: [
              {
                $count: "count",
              },
            ],
          },
        },
      ]);

      const products = result[0].products;
      const totalCount =
        result[0].totalCount.length > 0 ? result[0].totalCount[0].count : 0;
      const highestBidRecord = await Bid.aggregate([
        { $project: { maxAmount: { $max: ["$amount", "$highestBidAmount"] } } }, // Calculate max amount across both fields
        { $sort: { maxAmount: -1 } }, // Sort by maxAmount desc
        { $limit: 1 }, // Limit to one record (highest bid)
      ]);

      // return highestBidRecord[0];
      return success(res, i18n.__("FETCHDATA"), {
        products,
        count: totalCount,
        highestRange: highestBidRecord[0],
      });
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },

  //SingleProduct Deatails APi
  singleProductWithSellerDetails: async (req, res) => {
    try {
      // Decrypt the request body
      const requests = await decrypter(req.query);
      if (!requests) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      // Validate the decrypted request
      const v = new Validator(requests, {
        productId: "required",
      });
      const matched = await v.check();
      if (!matched) {
        return failedValidation(res, v);
      }

      // Find the product by productId
      let product = await Product.findById(requests.productId)
        .populate("categoryId", "enName arName")
        .populate("subCategoryId", "enName arName");

      if (!product) {
        return response(res, 422, i18n.__("NOTFOUND"));
      }

      // Fetch all data of the seller using the sellerId associated with the product
      const user = await User.findById(product.sellerId);

      // Fetch categories associated with the user
      const categoryIds = user.categories.map(
        (category) => category.categoryId
      );
      const categories = await Category.find({
        _id: {
          $in: categoryIds,
        },
      });

      // Check if the product and seller exist in the user's wishlist
      const wishListProduct = await WishList.findOne({
        userId: req.user._id,
        "products.productId": requests.productId,
      });
      const wishListSeller = await WishList.findOne({
        userId: req.user._id,
        "sellers.sellerId": product.sellerId,
      });

      // Find the highest bid amount for the product
      const highestBid = await Bid.findOne({
        productId: product._id,
        bidType: "purchase",
      }).sort({
        amount: -1,
      });

      // Check if the current user has placed a bid on the product
      const myBid = await Bid.findOne({
        productId: product._id,
        userId: req.user._id,
        bidType: "purchase",
      });
      console.log("sdd", {
        myBid,
      });

      console.log("sdd", {
        myBid,
      });

      // Calculate the average rating for the product (assuming ratings are stored in a separate collection)
      // const ratings = await ReviewRating.find({
      //   productId: product._id,
      // });
      const averageRating = await ReviewRating.aggregate([
        {
          $match: {
            sellerId: product.sellerId,
          },
        }, // Match reviews for the specific seller
        {
          $group: {
            _id: null,
            averageRating: {
              $avg: "$rating",
            },
          },
        }, // Calculate average rating
      ]);
      const totalRating =
        averageRating.length > 0 ? averageRating[0].averageRating : 0;
      // const totalRatings = ratings.length;

      // const sumOfRatings = ratings.reduce(
      //   (acc, rating) => acc + rating.value,
      //   0
      // );
      // console.log({sumOfRatings});

      // const averageRating = totalRatings > 0 ? sumOfRatings / totalRatings : 0;
      // console.log(totalRating.toFixed(1));
      console.log("++++++++++++", averageRating);

      const updatedRating =
        averageRating.length > 0
          ? averageRating[0].averageRating.toFixed(1)
          : 0;
      // Reconstruct the product object with additional seller information
      const productDetails = {
        ...product.toObject(),
        imageUrl: product.imageUrl,
        seller: {
          ...user.toObject(),
          categories: categories.map((category) => ({
            categoryId: category._id,
            enName: category.enName,
            arName: category.arName,
          })),
          nationalIdCardImageUrl: user.nationalIdCardUrl,
          isFav: wishListSeller ? true : false,
        },
        isWishlist: wishListProduct ? true : false,
        highestBidAmount: highestBid ? highestBid.highestBidAmount : 0,
        myBidAmount: myBid ? myBid.amount : 0,
        isBid: myBid ? true : false,
        averageRating: parseFloat(updatedRating)
          ? parseFloat(updatedRating)
          : 0,
      };

      // Respond with the fetched product and seller details
      return success(res, i18n.__("FETCHDATA"), {
        productDetails,
      });
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },

  getProductsAddedBySeller: async (req, res) => {
    try {
      // Decrypt request query parameters
      var requests = await decrypter(req.query);
      if (requests === false) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      // Validate the decrypted request
      const v = new Validator(requests, {
        sellerId: "required",
      });
      const matched = await v.check();
      if (!matched) {
        return failedValidation(res, v);
      }

      // Extract request parameters or set defaults
      let page = requests.page ? parseInt(requests.page) : 1;
      let pageSize = requests.limit ? parseInt(requests.limit) : 10;
      let skipIndex = (page - 1) * pageSize;
      let search = requests.search ? requests.search : "";
      let category = requests.category ? requests.category : "";
      let address = requests.address ? requests.address : "";

      // Define search parameters for products
      const params = {
        sellerId: new ObjectId(requests.sellerId),
        _id: {
          $ne: new ObjectId(requests.productId),
        },
        isDeleted: false,
        status: true,
        startDate: {
          $lte: new Date(),
        },
        endDate: {
          $gt: new Date(),
        },
      };

      if (category && category != "") {
        params.categoryId = new ObjectId(category);
      }
      if (address && address != "") {
        params.productLocation = address;
      }
      if (search && search != "") {
        const regex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/g;
        // Use the replace() function to remove the special characters
        if (search.match(regex)) {
          return success(res, i18n.__("FETCHDATA"), {
            products: [],
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

      // Aggregate query to get products and total count using $facet
      const result = await Product.aggregate([
        {
          $lookup: {
            from: "categories",
            localField: "categoryId",
            foreignField: "_id",
            as: "category",
          },
        },
        {
          $lookup: {
            from: "subcategories",
            localField: "subCategoryId",
            foreignField: "_id",
            as: "subCategory",
          },
        },
        {
          $match: params,
        },
        {
          $lookup: {
            from: "wishlists",
            let: {
              productId: "$_id",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$userId", new ObjectId(req.user._id)] },
                      { $in: ["$$productId", "$products.productId"] },
                    ],
                  },
                },
              },
              {
                $limit: 1,
              },
            ],
            as: "wishlist",
          },
        },
        {
          $lookup: {
            from: "bids",
            let: {
              productId: "$_id",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$productId", "$$productId"] },
                      { $eq: ["$userId", new ObjectId(req.user._id)] },
                    ],
                  },
                },
              },
              {
                $limit: 1,
              },
            ],
            as: "userBids",
          },
        },
        {
          $sort: {
            createdAt: -1,
          },
        },
        {
          $facet: {
            products: [
              {
                $skip: skipIndex,
              },
              {
                $limit: pageSize,
              },
              {
                $project: {
                  _id: 1,
                  sellerId: 1,
                  quantity: 1,
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
                  categoryId: {
                    _id: { $arrayElemAt: ["$category._id", 0] },
                    enName: { $arrayElemAt: ["$category.enName", 0] },
                    arName: { $arrayElemAt: ["$category.arName", 0] },
                  },
                  subCategoryId: {
                    _id: { $arrayElemAt: ["$subCategory._id", 0] },
                    enName: { $arrayElemAt: ["$subCategory.enName", 0] },
                    arName: { $arrayElemAt: ["$subCategory.arName", 0] },
                  },
                  isWishlist: {
                    $gt: [{ $size: "$wishlist" }, 0],
                  },
                  isBid: {
                    $gt: [{ $size: "$userBids" }, 0],
                  },
                },
              },
            ],
            totalCount: [
              {
                $count: "count",
              },
            ],
          },
        },
      ]);

      const products = result[0].products;
      const totalCount =
        result[0].totalCount.length > 0 ? result[0].totalCount[0].count : 0;

      return success(res, i18n.__("FETCHDATA"), {
        products,
        count: totalCount,
      });
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },

  addWishList: async (req, res) => {
    try {
      // Decrypt the request body
      const requests = await decrypter(req.body);
      if (!requests) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      // Validate the decrypted request
      const v = new Validator(requests, {
        type: "required|in:product,seller",
        productId: "requiredIf:type,product",
        sellerId: "requiredIf:type,seller",
      });
      const matched = await v.check();
      if (!matched) {
        return failedValidation(res, v);
      }

      // Check if the user is authenticated and get their userId
      const userId = req.user._id;

      let wishList = await WishList.findOne({
        userId,
      });

      if (!wishList) {
        wishList = new WishList({
          userId,
          products: [],
          sellers: [],
        });
      }

      // Check if the type is product or seller and add/remove from the corresponding list
      if (requests.type === "product") {
        const existingProductIndex = wishList.products.findIndex(
          (product) => product.productId.toString() === requests.productId
        );
        if (existingProductIndex !== -1) {
          wishList.products.splice(existingProductIndex, 1);
          await wishList.save();
          return success(res, i18n.__("WishList_Remove"), {});
        } else {
          wishList.products.push({
            productId: requests.productId,
          });
          await wishList.save();
          return success(res, i18n.__("WishList_Added"), {});
        }
      } else if (requests.type === "seller") {
        const existingSellerIndex = wishList.sellers.findIndex(
          (seller) => seller.sellerId.toString() === requests.sellerId
        );
        if (existingSellerIndex !== -1) {
          wishList.sellers.splice(existingSellerIndex, 1);
          await wishList.save();

          // Update the seller's favoriteCount

          await User.findByIdAndUpdate(
            requests.sellerId,
            { $inc: { favoriteCount: -1 } },
            { new: true } // This option returns the updated document
          );

          return success(res, i18n.__("Favourite_Remove"), {});
        } else {
          wishList.sellers.push({
            sellerId: requests.sellerId,
          });
          await wishList.save();

          // Update the seller's favoriteCount
          await User.findByIdAndUpdate(
            requests.sellerId,
            { $inc: { favoriteCount: 1 } },
            { new: true } // This option returns the updated document
          );

          return success(res, i18n.__("Favourite_Added"), {});
        }
      } else {
        return failed(res, "Invalid wish list type", {});
      }
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },

  getWishList: async (req, res) => {
    try {
      const requests = await decrypter(req.query);
      if (!requests) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      let page = requests.page ? parseInt(requests.page) : 1;
      let pageSize = requests.limit ? parseInt(requests.limit) : 10;
      let skipIndex = (page - 1) * pageSize;
      let search = requests.search ? requests.search : "";

      let query = {
        userId: new ObjectId(req.user._id),
      };
      console.log("sdfd", query);
      // If search term is provided, search for products by subcategory name
      if (search && search != "") {
        console.log("search");
        const regex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/g;
        // Use the replace() function to remove the special characters
        if (search.match(regex)) {
          return success(res, i18n.__("FETCHDATA"), {
            products: [],
            count: 0,
          });
        }
        let searchNew = search.replace(regex, "");
        // Find subcategory by name
        query.$or = [
          {
            "subCategory.enName": {
              $regex: searchNew,
              $options: "i",
            },
          },
          {
            "subCategory.arName": {
              $regex: searchNew,
              $options: "i",
            },
          },
        ];
      }
      const currentDate = new Date();

      // Aggregate query to get wish list products with their details
      const wishListProducts = await WishList.aggregate([
        {
          $unwind: "$products",
        }, // Deconstruct products array
        {
          $lookup: {
            from: "products", // Collection to lookup
            localField: "products.productId",
            foreignField: "_id",
            as: "productDetails",
          },
        },
        {
          $lookup: {
            from: "categories",
            localField: "productDetails.categoryId",
            foreignField: "_id",
            as: "category",
          },
        },
        {
          $lookup: {
            from: "subcategories",
            localField: "productDetails.subCategoryId",
            foreignField: "_id",
            as: "subCategory",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "productDetails.sellerId",
            foreignField: "_id",
            as: "seller",
          },
        },
        {
          $match: { ...query, "seller.status": true },
        },
        {
          $unwind: "$productDetails",
        }, // Deconstruct productDetails array
        {
          $match: {
            "productDetails.isDeleted": false,
            "productDetails.status": true,
            "productDetails.endDate": { $gt: currentDate },
          },
        }, // Filter products
        {
          $lookup: {
            from: "bids",
            let: {
              productId: "$productDetails._id",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$productId", "$$productId"] },
                      { $eq: ["$userId", new ObjectId(req.user._id)] },
                    ],
                  },
                },
              },
              {
                $limit: 1,
              },
            ],
            as: "userBids",
          },
        },
        {
          $project: {
            _id: "$productDetails._id",
            sellerId: "$productDetails.sellerId",
            quantity: "$productDetails.quantity",
            unit: "$productDetails.unit",
            price: "$productDetails.price",
            description: "$productDetails.description",
            mobile: "$productDetails.mobile",
            countryCode: "$productDetails.countryCode",
            productLocation: "$productDetails.productLocation",
            startDate: "$productDetails.startDate",
            endDate: "$productDetails.endDate",
            startTime: "$productDetails.startTime",
            endTime: "$productDetails.endTime",
            status: "$productDetails.status",
            isDeleted: "$productDetails.isDeleted",
            createdAt: "$productDetails.createdAt",
            updatedAt: "$productDetails.updatedAt",
            categoryId: {
              _id: {
                $arrayElemAt: ["$category._id", 0],
              },
              enName: {
                $arrayElemAt: ["$category.enName", 0],
              },
              arName: {
                $arrayElemAt: ["$category.arName", 0],
              },
            },
            subCategoryId: {
              _id: {
                $arrayElemAt: ["$subCategory._id", 0],
              },
              enName: {
                $arrayElemAt: ["$subCategory.enName", 0],
              },
              arName: {
                $arrayElemAt: ["$subCategory.arName", 0],
              },
            },
            // Map other fields as needed
            isWishlist: true,
            imageUrl: {
              $concat: [
                process.env.AWS_URL,
                {
                  $arrayElemAt: ["$productDetails.images.productImage", 0],
                },
              ],
            },
            hasUserBid: {
              $gt: [{ $size: "$userBids" }, 0],
            },
          },
        },
        {
          $skip: skipIndex,
        }, // Skip documents
        {
          $limit: pageSize,
        }, // Limit documents
      ]);

      // Respond with the fetched wish list products
      return success(res, i18n.__("FETCHDATA"), {
        products: wishListProducts,
      });
    } catch (error) {
      dump(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },
  //hdjh
  getSellerFavorites: async (req, res) => {
    try {
      // Decrypt the request body
      const requests = await decrypter(req.query);
      if (!requests) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      let page = requests.page ? parseInt(requests.page) : 1;
      let pageSize = requests.limit ? parseInt(requests.limit) : 10;
      let skipIndex = (page - 1) * pageSize;
      let search = requests.search ? requests.search : "";

      // Get the user's ID
      const userId = new ObjectId(req.user._id);

      // Aggregate pipeline stages
      const pipeline = [
        {
          $match: {
            userId: userId,
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "sellers.sellerId",
            foreignField: "_id",
            as: "sellerDetails",
          },
        },
        {
          $unwind: "$sellerDetails",
        },
        {
          $match: {
            "sellerDetails.status": true,
          },
        },
      ];

      // Add search stage if search term is provided
      if (search && search.trim() !== "") {
        const regex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/g;
        if (search.match(regex)) {
          return success(res, i18n.__("FETCHDATA"), {
            sellers: [],
            count: 0,
          });
        }
        let searchNew = search.replace(regex, "");
        pipeline.push({
          $match: {
            "sellerDetails.userName": {
              $regex: searchNew,
              $options: "i",
            },
          },
        });
      }

      pipeline.push(
        {
          $lookup: {
            from: "reviewratings",
            localField: "sellerDetails._id",
            foreignField: "sellerId",
            as: "review",
          },
        },
        {
          $addFields: {
            averageRating: {
              $round: [
                {
                  $avg: "$review.rating",
                },
                1,
              ],
            },
          },
        },
        {
          $skip: skipIndex,
        },
        {
          $limit: pageSize,
        }
      );

      // Execute aggregation pipeline
      const wishList = await WishList.aggregate(pipeline);

      // Extract seller details from the wish list
      const sellers = wishList.map((item) => ({
        ...item.sellerDetails,
        fav: true,
        averageRating: item.averageRating || 0,
      }));

      // Respond with the fetched sellers
      return success(res, i18n.__("FETCHDATA"), {
        sellers,
      });
    } catch (error) {
      console.error("Error in getSellerFavorites:", error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },

  singleSellerDetails: async (req, res) => {
    try {
      // Decrypt the request body
      const requests = await decrypter(req.query);
      if (!requests) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      // Validate the decrypted request
      const v = new Validator(requests, {
        sellerId: "required",
      });
      const matched = await v.check();
      if (!matched) {
        return failedValidation(res, v);
      }

      const sellerId = new ObjectId(requests.sellerId);

      // Fetch all data of the seller using the sellerId associated with the product
      const user = await User.findById(sellerId).select(
        "-password -tempPasswords"
      );

      if (!user) {
        return response(res, 422, i18n.__("NOTFOUND"));
      }

      // Fetch categories associated with the user
      const categoryIds = user.categories.map(
        (category) => category.categoryId
      );
      const categories = await Category.find({
        _id: {
          $in: categoryIds,
        },
      });

      // Check if the seller exists in the user's wishlist
      const wishListSeller = await WishList.findOne({
        userId: req.user._id,
        "sellers.sellerId": sellerId,
      });

      // Fetch reviews for the seller
      //  const sellerReviews = await ReviewRating.find({ sellerId });

      // Calculate the average rating
      // let totalRating = 0;
      // if (sellerReviews.length > 0) {
      //     totalRating = sellerReviews.reduce((sum, review) => sum + review.rating, 0);
      //     totalRating /= sellerReviews.length;
      // }

      const averageRating = await ReviewRating.aggregate([
        {
          $match: {
            sellerId: sellerId,
          },
        }, // Match reviews for the specific seller
        {
          $group: {
            _id: null,
            averageRating: {
              $avg: "$rating",
            },
          },
        }, // Calculate average rating
      ]);
      console.log(sellerId);
      // Extract the average rating from the result
      const totalRating =
        averageRating.length > 0 ? averageRating[0].averageRating : 0;
      const updatedRating = totalRating.toFixed(1);
      // Reconstruct the seller object with additional details
      const seller = {
        ...user.toObject(),
        categories: categories.map((category) => ({
          categoryId: category._id,
          enName: category.enName,
          arName: category.arName,
        })),
        nationalIdCardImageUrl: user.nationalIdCardUrl,
        isFav: wishListSeller ? true : false,
        averageRating: parseFloat(updatedRating), // Rounded to 2 decimal places
      };

      // Respond with the fetched seller details
      return success(res, i18n.__("FETCHDATA"), {
        seller,
      });
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },

  getBestSellers: async (req, res) => {
    try {
      // Pagination parameters
      const requests = await decrypter(req.query);
      if (!requests) {
        return response(res, 500, i18n.__("Internal_Error"));
      }
      const page = requests.page ? parseInt(requests.page) : 1;
      const pageSize = requests.limit ? parseInt(requests.limit) : 10;
      const skipIndex = (page - 1) * pageSize;

      // const page = parseInt(requests.page) || 1;
      // const pageSize = parseInt(requests.limit) || 10;
      // const skip = (page - 1) * pageSize;
      let search = requests.search ? requests.search : "";

      // Match and aggregation pipeline
      let query = {
        userType: {
          $in: ["seller"],
        },
        status: true,
      };
      if (search && search != "") {
        const regex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/g;
        // Use the replace() function to remove the special characters
        if (search.match(regex)) {
          return success(res, i18n.__("FETCHDATA"), {
            bestSellers: [],
            count: 0,
          });
        }
        let searchNew = search.replace(regex, "");
        // Find subcategory by name
        query.$or = [
          {
            userName: {
              $regex: searchNew,
              $options: "i",
            },
          },
        ];
      }
      let sort = {
        totalRating: -1,
      };
      if (requests.filter && requests.filter === "highestRating") {
        sort = {
          totalRating: -1,
        };
      } else if (requests.filter && requests.filter === "lowestRating") {
        console.log("}}}}}}}}}}}}}}}}}}");

        sort = {
          totalRating: 1,
        };
      } else if (requests.filter && requests.filter === "newlyListed") {
        sort = {
          createdAt: -1,
        };
      } else if (requests.filter && requests.filter === "mostFavourite") {
        // console.log(434234234244)
        sort = {
          favoriteCount: 1,
        };
      } else if (requests.filter && requests.filter === "mostSelling") {
      }

      // Aggregation pipeline
      const pipeline = [
        {
          $match: query,
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
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
            from: "categories",
            localField: "categories.categoryId",
            foreignField: "_id",
            as: "categoryDetails",
          },
        },
        {
          $lookup: {
            from: "reviewratings",
            localField: "_id",
            foreignField: "sellerId",
            as: "review",
          },
        },
        {
          $lookup: {
            from: "wishlists",
            localField: "_id",
            foreignField: "sellers.sellerId",
            as: "wishlist",
          },
        },

        {
          $addFields: {
            categories: {
              $map: {
                input: "$categoryDetails",
                as: "category",
                in: {
                  categoryId: "$$category._id",
                  enName: "$$category.enName",
                  arName: "$$category.arName",
                },
              },
            },
            averageRating: {
              $round: [
                {
                  $avg: "$review.rating",
                },
                1,
              ],
            },
            fav: {
              $cond: {
                if: {
                  $gt: [
                    {
                      $size: "$wishlist",
                    },
                    0,
                  ],
                },
                then: true,
                else: false,
              },
            },
          },
        },
        {
          $sort: {
            "sellerDetails.favoriteCount": -1, // Sort by favoriteCount in descending order
          },
        },

        {
          $project: {
            _id: 0, // Exclude _id field
            sellerId: "$sellerDetails._id", // Rename _id to sellerId
            name: "$sellerDetails.name", // Include sellerDetails
            userName: "$sellerDetails.userName", // Include sellerDetails
            address: "$sellerDetails.address",
            favoriteCount: 1, // Include favoriteCount
            categories: 1,
            totalRating: 1,
            totalUser: 1,
            fav: 1,
            averageRating: 1,
          },
        },
        {
          $sort: sort,
        },
        {
          $skip: skipIndex,
        },
        // {
        //   $limit: 10,
        // },
      ];

      const userId = req.user._id;
      // Execute the aggregate pipeline
      const bestSellers = await User.aggregate(pipeline);
      let newBestSellers = [];
      for (let i = 0; i < bestSellers.length; i++) {
        const element = bestSellers[i];
        if (
          element.fav === true &&
          element.averageRating !== null &&
          element.sellerId != userId
        ) {
          console.log(element, "+++++++++++++");

          newBestSellers.push(element);
        }
      }

      console.log(newBestSellers);
      // Count total documents
      const totalCount = await User.countDocuments(query);

      // Calculate total pages
      const totalPages = Math.ceil(totalCount / pageSize);

      return success(res, i18n.__("FETCHDATA"), {
        bestSellers: newBestSellers,
        count: newBestSellers.length,
      });
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },
  allProductFeatured: async (req, res) => {
    try {
      // Decrypt request query parameters
      var requests = await decrypter(req.query);
      if (requests === false) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      // Extract request parameters or set defaults
      let page = requests.page ? parseInt(requests.page) : 1;
      let pageSize = requests.limit ? parseInt(requests.limit) : 10;
      let skipIndex = (page - 1) * pageSize;
      let search = requests.search ? requests.search : "";
      let category = requests.category ? requests.category : "";
      // let address = requests.address ? requests.address : '';
      let price = requests.price ? parseInt(requests.price) : 1;
      let remainingHours = requests.remainingHours
        ? parseInt(requests.remainingHours)
        : "";

      let currentDate = new Date();
      let biddingDate = moment(currentDate).format("YYYY-MM-DD");

      // Define search parameters for products
      let params = {
        sellerId: {
          $ne: new ObjectId(req.user._id),
        },
        isDeleted: false,
        status: true,
        isFeatured: true,
      };
      if (price && price != 1) {
        params.price = {
          $lte: price,
        };
      }
      if (remainingHours && remainingHours != "") {
        // Calculate the current time and the time 7 hours ago
        const currentTime = new Date();
        const timeThreshold = new Date(
          currentTime.getTime() + remainingHours * 60 * 60 * 1000
        );
        params.endDate = {
          $lte: timeThreshold,
          $gte: currentTime,
        };
      }

      if (category && category != "") {
        params.categoryId = new ObjectId(category);
      }
      // if (address && address != '') {
      //     params.productLocation = address;
      // }
      if (search && search != "") {
        const regex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/g;
        // Use the replace() function to remove the special characters
        if (search.match(regex)) {
          return success(res, i18n.__("FETCHDATA"), {
            products: [],
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
      console.log("++++++++", req.user._id);

      // Aggregate query to get products and total count using $facet
      const result = await Product.aggregate([
        {
          $lookup: {
            from: "categories",
            localField: "categoryId",
            foreignField: "_id",
            as: "category",
          },
        },
        {
          $lookup: {
            from: "subcategories",
            localField: "subCategoryId",
            foreignField: "_id",
            as: "subCategory",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "sellerId",
            foreignField: "_id",
            as: "seller",
          },
        },
        {
          $match: {
            ...params,
            "seller.status": true,
          },
        },
        {
          $lookup: {
            from: "wishlists",
            let: {
              productId: "$_id",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      {
                        $eq: ["$userId", new ObjectId(req.user._id)],
                      },
                      {
                        $in: ["$$productId", "$products.productId"],
                      },
                    ],
                  },
                },
              },
              {
                $limit: 1,
              },
            ],
            as: "wishlist",
          },
        },
        {
          $lookup: {
            from: "bids",
            let: {
              productId: "$_id",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      {
                        $eq: ["$productId", "$$productId"],
                      },
                      {
                        $eq: ["$userId", new ObjectId(req.user._id)],
                      },
                    ],
                  },
                },
              },
              {
                $limit: 1,
              },
            ],
            as: "userBids",
          },
        },
        {
          $lookup: {
            from: "bids",
            localField: "_id",
            foreignField: "productId",
            as: "allBids",
          },
        },
        {
          $addFields: {
            bidCount: { $size: "$allBids" },
          },
        },
        {
          $sort: {
            isFeatured: -1, // First sort by isFeatured
            createdAt: -1, // Then sort by createdAt
          },
        },
        {
          $facet: {
            products: [
              {
                $skip: skipIndex,
              },
              {
                $limit: pageSize,
              },
              {
                $project: {
                  _id: 1,
                  sellerId: 1,
                  quantity: 1,
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
                  isFeatured: 1,
                  imageUrl: {
                    $cond: {
                      if: {
                        $isArray: "$images",
                      },
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
                  categoryId: {
                    _id: {
                      $arrayElemAt: ["$category._id", 0],
                    },
                    enName: {
                      $arrayElemAt: ["$category.enName", 0],
                    },
                    arName: {
                      $arrayElemAt: ["$category.arName", 0],
                    },
                  },
                  subCategoryId: {
                    _id: {
                      $arrayElemAt: ["$subCategory._id", 0],
                    },
                    enName: {
                      $arrayElemAt: ["$subCategory.enName", 0],
                    },
                    arName: {
                      $arrayElemAt: ["$subCategory.arName", 0],
                    },
                  },
                  isWishlist: {
                    $gt: [
                      {
                        $size: "$wishlist",
                      },
                      0,
                    ],
                  },
                  isBid: {
                    $gt: [
                      {
                        $size: "$userBids",
                      },
                      0,
                    ],
                  },
                  bidCount: 1,
                },
              },
            ],
            totalCount: [
              {
                $count: "count",
              },
            ],
          },
        },
      ]);

      const products = result[0].products;
      const totalCount =
        result[0].totalCount.length > 0 ? result[0].totalCount[0].count : 0;
      const highestBidRecord = await Bid.aggregate([
        { $project: { maxAmount: { $max: ["$amount", "$highestBidAmount"] } } }, // Calculate max amount across both fields
        { $sort: { maxAmount: -1 } }, // Sort by maxAmount desc
        { $limit: 1 }, // Limit to one record (highest bid)
      ]);

      // return highestBidRecord[0];
      return success(res, i18n.__("FETCHDATA"), {
        products,
        count: totalCount,
        highestRange: highestBidRecord[0],
      });
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },

  // allProductFeatured: async (req, res) => {
  //   try {
  //     const requests = await decrypter(req.query);
  //     if (!requests) {
  //       return response(res, 500, i18n.__("Internal_Error"));
  //     }

  //     const userId = new ObjectId(req.user._id);
  //     console.log("$$$$$$$$$$", userId);
  //     let query = {
  //       bidType: "featured",
  //       sellerId: {
  //         $ne: new ObjectId(userId),
  //       },
  //     };

  //     let currentDate = new Date();
  //     let biddingDate = moment(currentDate).format("YYYY-MM-DD");

  //     if (biddingDate) {
  //       query.biddingDate = new Date(biddingDate);
  //     }

  //     // Define your query here

  //     // Ensure req.user._id is available

  //     const pipeline = [
  //       {
  //         $match: query,
  //       },

  //       {
  //         $group: {
  //           _id: "$subCategoryId",
  //           highestBid: {
  //             $first: "$$ROOT",
  //           }, // Get the first bid document for each subCategoryId
  //         },
  //       },
  //       {
  //         $replaceRoot: {
  //           newRoot: "$highestBid",
  //         }, // Replace the root with the highest bid document
  //       },
  //       {
  //         $lookup: {
  //           from: "subcategories",
  //           localField: "subCategoryId",
  //           foreignField: "_id",
  //           as: "subCategoryName",
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
  //         $match: {
  //           "user.status": true,
  //         },
  //       },
  //       {
  //         $lookup: {
  //           from: "products",
  //           localField: "productId",
  //           foreignField: "_id",
  //           as: "productDetails",
  //         },
  //       },
  //       {
  //         $lookup: {
  //           from: "bids",
  //           let: {
  //             productId: "$productId",
  //           },
  //           pipeline: [
  //             {
  //               $match: {
  //                 $expr: {
  //                   $and: [
  //                     { $eq: ["$productId", "$$productId"] },
  //                     { $eq: ["$userId", userId] },
  //                   ],
  //                 },
  //               },
  //             },
  //             {
  //               $limit: 1,
  //             },
  //           ],
  //           as: "userBids",
  //         },
  //       },
  //       {
  //         $lookup: {
  //           from: "wishlists",
  //           let: {
  //             productId: "$productId",
  //           },
  //           pipeline: [
  //             {
  //               $match: {
  //                 $expr: {
  //                   $and: [
  //                     {
  //                       $eq: ["$userId", userId],
  //                     },
  //                     {
  //                       $in: ["$$productId", "$products.productId"],
  //                     },
  //                   ],
  //                 },
  //               },
  //             },
  //             {
  //               $limit: 1,
  //             },
  //           ],
  //           as: "wishlist",
  //         },
  //       },
  //       {
  //         $addFields: {
  //           userName: {
  //             $arrayElemAt: ["$user.userName", 0],
  //           },
  //           subCategoryName: {
  //             $cond: {
  //               if: {
  //                 $isArray: "$subCategoryName",
  //               },
  //               then: {
  //                 _id: {
  //                   $arrayElemAt: ["$subCategoryName._id", 0],
  //                 },
  //                 enName: {
  //                   $arrayElemAt: ["$subCategoryName.enName", 0],
  //                 },
  //                 arName: {
  //                   $arrayElemAt: ["$subCategoryName.arName", 0],
  //                 },
  //               },
  //               else: null,
  //             },
  //           },
  //           productDetails: {
  //             $arrayElemAt: ["$productDetails", 0],
  //           },
  //           isBid: {
  //             $gt: [{ $size: "$userBids" }, 0],
  //           },
  //         },
  //       },
  //       {
  //         $project: {
  //           _id: 1,
  //           userId: 1,
  //           subCategoryId: 1,
  //           productId: 1,
  //           bidType: 1,
  //           amount: 1,
  //           biddingDate: 1,
  //           createdAt: 1,
  //           updatedAt: 1,
  //           subCategoryName: 1,
  //           userName: 1,
  //           productDetails: {
  //             _id: 1,
  //             sellerId: 1,
  //             quantity: 1,
  //             unit: 1,
  //             price: 1,
  //             description: 1,
  //             productLocation: 1,
  //             endDate: 1,
  //             imageUrl: {
  //               $cond: {
  //                 if: {
  //                   $isArray: "$productDetails.images.productImage",
  //                 },
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
  //           isBid: 1,
  //           isWishlist: {
  //             $gt: [
  //               {
  //                 $size: "$wishlist",
  //               },
  //               0,
  //             ],
  //           },
  //         },
  //       },
  //       {
  //         $sort: {
  //           amount: -1, // Sort bids by amount in descending order
  //         },
  //       },
  //     ];

  //     // Execute the aggregation pipeline
  //     const highestBid = await Bid.aggregate(pipeline);

  //     return success(res, i18n.__("FETCHDATA"), {
  //       highestBid,
  //     });
  //   } catch (error) {
  //     console.error(error);
  //     return serverError(res, 500, i18n.__("Internal_Error"));
  //   }
  // },

  homeProductList: async (req, res) => {
    try {
      // Decrypt request query parameters
      const requests = await decrypter(req.query);
      if (requests === false) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      // Extract request parameters or set defaults
      let { page, limit, search, category } = requests;

      const specificDate = new Date("2024-04-24T00:30:00.000Z");
      //   const date = new Date();
      const date = moment().format("YYYY-MM-DD");

      page = parseInt(page) || 1;
      const pageSize = parseInt(limit) || 10;
      const skipIndex = (page - 1) * pageSize;
      search = search || "";
      category = category || "";
      // Define search parameters for products
      let params = {};
      if (requests.searchType == "global") {
        params = {
          sellerId: {
            $ne: new ObjectId(req.user._id),
          },
          isDeleted: false,
          status: true,
          // newsStartDate: date,
          endDate: { $gte: new Date() },
        };
      } else {
        params = {
          sellerId: {
            $ne: new ObjectId(req.user._id),
          },
          isDeleted: false,
          status: true,
          newsStartDate: date,
          endDate: { $gte: new Date() },
        };
      }

      //   console.log("Date++++++++++", new Date());
      if (search && search !== "") {
        //Save search history
        await saveSearchHistory(req.user._id, search);

        const regex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/g;
        // Use the replace() function to remove the special characters
        if (search.match(regex)) {
          return success(res, i18n.__("FETCHDATA"), {
            products: [],
            count: 0,
          });
        }
        const searchnew = search.replace(regex, "");
        // Find subcategory by name
        params.$or = [
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
          {
            "category.enName": {
              $regex: searchnew,
              $options: "i",
            },
          },
          {
            "category.arName": {
              $regex: searchnew,
              $options: "i",
            },
          },
        ];
      }
      // Aggregate search history to count product searches
      const searchCounts = await searchHistory.aggregate([
        // { $match: { userId: new ObjectId(req.user._id) } }, // Filter by userId
        { $group: { _id: "$productName", count: { $sum: 1 } } }, // Count occurrences of each productName
        { $sort: { count: -1 } }, // Sort by count desc
        { $limit: 6 }, // Limit to top 6
      ]);
      console.log({ searchCounts });
      // Aggregate query to get products and total count using $facet
      const result = await Product.aggregate([
        {
          $lookup: {
            from: "categories",
            localField: "categoryId",
            foreignField: "_id",
            as: "category",
          },
        },
        {
          $lookup: {
            from: "subcategories",
            localField: "subCategoryId",
            foreignField: "_id",
            as: "subCategory",
          },
        },
        {
          $addFields: {
            newsStartDate: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$startDate",
              },
            },
          },
        },
        {
          $lookup: {
            from: "wishlists",
            let: {
              productId: "$_id",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      {
                        $eq: ["$userId", new ObjectId(req.user._id)],
                      },
                      {
                        $in: ["$$productId", "$products.productId"],
                      },
                    ],
                  },
                },
              },
              {
                $limit: 1,
              },
            ],
            as: "wishlist",
          },
        },
        {
          $lookup: {
            from: "bids",
            let: {
              productId: "$_id",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$productId", "$$productId"] },
                      { $eq: ["$userId", new ObjectId(req.user._id)] },
                    ],
                  },
                },
              },
              {
                $limit: 1,
              },
            ],
            as: "userBids",
          },
        },
        {
          $match: params,
        },

        {
          $sort: {
            createdAt: -1,
          },
        },
        {
          $facet: {
            products: [
              {
                $skip: skipIndex,
              },
              {
                $limit: pageSize,
              },
              {
                $project: {
                  _id: 1,
                  sellerId: 1,
                  newsStartDate: 1,
                  quantity: 1,
                  unit: 1,
                  price: 1,
                  description: 1,
                  mobile: 1,
                  countryCode: 1,
                  productLocation: 1,
                  startDate: {
                    $dateToString: {
                      format: "%Y-%m-%d %H:%M:%S",
                      date: "$startDate",
                    },
                  },
                  endDate: 1,
                  startTime: 1,
                  endTime: 1,
                  status: 1,
                  isDeleted: 1,
                  createdAt: 1,
                  updatedAt: 1,
                  imageUrl: {
                    $cond: {
                      if: {
                        $isArray: "$images",
                      },
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
                  categoryId: {
                    _id: {
                      $arrayElemAt: ["$category._id", 0],
                    },
                    enName: {
                      $arrayElemAt: ["$category.enName", 0],
                    },
                    arName: {
                      $arrayElemAt: ["$category.arName", 0],
                    },
                  },
                  subCategoryId: {
                    _id: {
                      $arrayElemAt: ["$subCategory._id", 0],
                    },
                    enName: {
                      $arrayElemAt: ["$subCategory.enName", 0],
                    },
                    arName: {
                      $arrayElemAt: ["$subCategory.arName", 0],
                    },
                  },
                  isWishlist: {
                    $gt: [
                      {
                        $size: "$wishlist",
                      },
                      0,
                    ],
                  },
                  hasUserBid: {
                    $gt: [{ $size: "$userBids" }, 0],
                  },
                },
              },
            ],
            totalCount: [
              {
                $count: "count",
              },
            ],
          },
        },
      ]);

      const products = result[0].products;
      const totalCount =
        result[0].totalCount.length > 0 ? result[0].totalCount[0].count : 0;

      return success(res, i18n.__("FETCHDATA"), {
        products,
        count: totalCount,
        searchCounts,
      });
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },
};
