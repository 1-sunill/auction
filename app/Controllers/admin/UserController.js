const { Validator } = require("node-input-validator");
const User = require("../../../app/Models/User");
const Category = require("../../../app/Models/Category");
const Order = require("../../../app/Models/Order");
const Bid = require("../../../app/Models/Bid");

const response = require("../../../helper/helper");
const FileUpload = require("../../../services/upload-files");
const {
  serverError,
  validateFail,
  failed,
  success,
} = require("../../../helper/helper");
const mongoose = require("mongoose");
const { ObjectId } = require("mongodb");
const moment = require("moment");
const { sendNewNotification } = require("../../../helper/commonHelper");

module.exports = {
  editProfile: async (req, res) => {
    try {
      // Validate the request body
      const v = new Validator(req.body, {
        userId: "required",
        userType: "required|in:bidder,seller",
        name: "required",
        businessName: "requiredIf:userType,seller",
        address: "requiredIf:userType,seller",
        categories: "requiredIf:userType,seller",
        licenceNumber: "requiredIf:userType,seller",
        // Add other fields as needed
      });
      const matched = await v.check();
      if (!matched) {
        return validateFail(res, v);
      }
      const { userId } = req.body;
      // Find the user by ID
      let userExist = await User.findById(userId);
      if (!userExist) {
        return failed(res, "User not found.", {});
      }

      // Update user details based on the provided information
      // Update only the fields that are present in the request body
      userExist.name = req.body.name;
      userExist.email = req.body.email || "";
      userExist.taxRegistrationNumber = req.body.taxRegistrationNumber || "";

      if (req.body.userType === "seller") {
        userExist.businessName = req.body.businessName;
        userExist.address = req.body.address;
        userExist.licenceNumber = req.body.licenceNumber || "";
        userExist.bio = req.body.bio || "";
        if (req.body.categories) {
          let categoriesArray = Array.isArray(req.body.categories)
            ? req.body.categories
            : req.body.categories.split(",");
          if (categoriesArray.length === 1) {
            // If there's only one category, directly assign its categoryId
            userExist.categories = [
              {
                categoryId: new ObjectId(categoriesArray[0]),
              },
            ];
          } else {
            // If there are multiple categories, map each category to its categoryId
            userExist.categories = categoriesArray.map((category) => ({
              categoryId: new ObjectId(category),
            }));
          }
        }

        if (req.body.lat && req.body.long) {
          let coordinates = [
            parseFloat(req.body.long),
            parseFloat(req.body.lat),
          ];
          let location = {
            type: "Point",
            coordinates,
          };
          req.body.location = location;
        }
        userExist.location = req.body.location;
        if (req.files) {
          const newImageFileName = await FileUpload.aws(
            req.files.nationalIdCard,
            "IdProofImages"
          );
          userExist.nationalIdCard = newImageFileName.Key;
        }
      }

      await userExist.save();
      userExist.password = undefined;
      // Prepare response data
      const responseData = {
        userDetails: userExist,
      };

      // Return success response
      return success(res, "Profile updated successfully!", responseData);
    } catch (error) {
      console.error(error);
      return serverError(res, "Internal Server Error");
    }
  },

  editProfiles: async (req, res) => {
    try {
      const v = new Validator(req.body, {
        userId: "required",
        userType: "required|in:bidder,seller",
        name: "required",
        businessName: "requiredIf:userType,seller",
        address: "requiredIf:userType,seller",
        categories: "requiredIf:userType,seller",
        licenceNumber: "requiredIf:userType,seller",
      });

      const matched = await v.check();
      if (!matched) {
        return validateFail(res, v);
      }

      const {
        userId,
        name,
        businessName,
        address,
        categories,
        licenceNumber,
        email,
        // Add other profile fields as needed
      } = req.body;

      // Check if the user with the given userId exists
      let user = await User.findById(userId);
      if (!user) {
        return failed(res, "User Not Found!", {});
      }

      // Update user fields if provided
      updateObject;
      user.userType = userType;
      user.name = name;
      user.businessName = businessName;
      user.address = address;
      user.categories = categories;
      user.licenceNumber = licenceNumber;
      if (email) user.email = email;

      const updateObject = {
        name,
        businessName,
        address,
        categories,
        licenceNumber,
        email,
      };

      // Update other profile fields as needed
      if (req.files && req.files.nationalIdCard) {
        const newImageFileName = await FileUpload.aws(req.files.nationalIdCard);
        updateObject.nationalIdCard = newImageFileName.Key;
      }

      // Use findOneAndUpdate to update the category
      const updatedUser = await User.findOneAndUpdate(
        {
          _id: userId,
        },
        updateObject,
        {
          new: true,
        }
      );
      // Save the updated user

      return success(res, "Profile updated successfully!", updatedUser);
    } catch (error) {
      console.error(error);
      return serverError(res, "Internal Server Error");
    }
  },

  getSellers: async (req, res) => {
    let { page = 1, pageSize = 10 } = req.query;
    page = parseInt(page);
    pageSize = parseInt(pageSize);
    const skipIndex = (page - 1) * pageSize;

    try {
      const {
        page = 1,
        search,
        profileStatus,
        startDate,
        endDate,
        sortBy,
      } = req.query;

      let query = {
        userType: "seller",
        isDeleted: false,
      };

      if (profileStatus) {
        query.adminVerifyStatus = profileStatus;
      }

      if (search) {
        query.$or = [
          {
            userName: {
              $regex: new RegExp(search, "i"),
            },
          },
          {
            name: {
              $regex: new RegExp(search, "i"),
            },
          },
          {
            email: {
              $regex: new RegExp(search, "i"),
            },
          },
          {
            mobile: {
              $regex: new RegExp(search, "i"),
            },
          },
        ];
      }

      if (profileStatus === "Pending") {
        if (startDate && endDate) {
          query.createdAt = {
            $gte: new Date(startDate + " 00:00:00"),
            $lte: new Date(endDate + " 23:59:00"),
          };
        }
      } else if (profileStatus === "Rejected") {
        if (startDate && endDate) {
          query.rejectedAt = {
            $gte: new Date(startDate + " 00:00:00"),
            $lte: new Date(endDate + " 23:59:00"),
          };
        }
      } else if (profileStatus === "Accepted") {
        if (startDate && endDate) {
          query.acceptedAt = {
            $gte: new Date(startDate + " 00:00:00"),
            $lte: new Date(endDate + " 23:59:00"),
          };
        }
      }

      var sortOptions = {};

      if (sortBy == 1) {
        // oldest to newest
        if (profileStatus === "Accepted") {
          sortOptions = {
            acceptedAt: 1,
          }; // Sort by acceptedAt in ascending order for Accepted profiles
        } else if (profileStatus === "Rejected") {
          sortOptions = {
            rejectedAt: 1,
          }; // Sort by rejectedAt in ascending order for Rejected profiles
        }
      } else if (sortBy == 2 && profileStatus !== "Pending") {
        // newest to oldest
        if (profileStatus === "Accepted") {
          sortOptions = {
            acceptedAt: -1,
          }; // Sort by acceptedAt in descending order for Accepted profiles
        } else if (profileStatus === "Rejected") {
          sortOptions = {
            rejectedAt: -1,
          }; // Sort by rejectedAt in descending order for Rejected profiles
        }
      } else if (sortBy == 3) {
        // a to z at first
        sortOptions = {
          userName: 1,
        };
      } else if (sortBy == 4) {
        // z to a at last
        sortOptions = {
          userName: -1,
        };
      } else if (sortBy == 2 && profileStatus === "Pending") {
        // z to a at last
        sortOptions = {
          createdAt: -1,
        };
      } else {
        sortOptions = {
          createdAt: -1,
        };
      }

      console.log("sortOptions1111111111111111", sortBy);

      // const sellerList = await User.find(query)
      //   .sort(sortOptions)
      //   .skip((page - 1) * ITEMS_PER_PAGE)
      //   .limit(ITEMS_PER_PAGE)
      //   .populate({
      //     path: "categories.categoryId",
      //     select: "enName arName",
      //   })
      //   .collation({ locale: "en_US", numericOrdering: true });
      const currentDate = new Date();

      // Aggregation pipeline to fetch the seller list with required details
      const sellerList = await User.aggregate([
        { $match: query },
        {
          $lookup: {
            from: "categories",
            localField: "categories.categoryId",
            foreignField: "_id",
            as: "categoriesDetails",
          },
        },
        {
          $lookup: {
            from: "orders",
            localField: "_id",
            foreignField: "sellerId",
            as: "orderDetails",
          },
        },
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "sellerId",
            as: "productDetails",
          },
        },
        {
          $addFields: {
            soldProducts: { $size: "$orderDetails" },
            liveProductCount: {
              $size: {
                $filter: {
                  input: "$productDetails",
                  as: "product",
                  cond: {
                    $and: [
                      { $lte: ["$$product.startDate", currentDate] },
                      { $gte: ["$$product.endDate", currentDate] },
                    ],
                  },
                },
              },
            },
          },
        },
        {
          $group: {
            _id: "$_id",
            createdAt: { $first: "$createdAt" },
            userName: { $first: "$userName" },
            businessName: { $first: "$businessName" },
            location: { $first: "$location" },
            address: { $first: "$address" },
            name: { $first: "$name" },
            email: { $first: "$email" },
            countryCode: { $first: "$countryCode" },
            mobile: { $first: "$mobile" },
            status: { $first: "$status" },
            userType: { $first: "$userType" },
            profile_image: { $first: "$profile_image" },
            categories: { $first: "$categories" },
            categoriesDetails: { $push: "$categoriesDetails" },
            acceptedAt: { $first: "$acceptedAt" },
            soldProducts: { $first: "$soldProducts" },
            liveProductCount: { $first: "$liveProductCount" },
            rejectedAt: { $first: "$rejectedAt" },
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
        {
          $project: {
            _id: 1,
            createdAt: 1,
            userName: 1,
            businessName: 1,
            location: 1,
            address: 1,
            name: 1,
            email: 1,
            countryCode: 1,
            mobile: 1,
            status: 1,
            userType: 1,
            profile_image: 1,
            categories: 1,
            categoriesDetails: 1,
            acceptedAt: 1,
            soldProducts: 1,
            liveProductCount: 1,
            rejectedAt: 1,
          },
        },
      ]);

      // Aggregation pipeline to fetch the total count of sellers
      const totalItemsResult = await User.aggregate([
        { $match: query },
        {
          $count: "totalCount",
        },
      ]);

      const totalItems =
        totalItemsResult.length > 0 ? totalItemsResult[0].totalCount : 0;
      const totalPages = Math.ceil(totalItems / pageSize);

      console.log("########", totalItems);

      return success(res, "Sellers fetched successfully!", {
        sellerList,
        totalItems,
        totalPages,
      });
    } catch (error) {
      console.error(error);
      return serverError(res, "Internal Server Error");
    }
  },

  getBidders: async (req, res) => {
    const ITEMS_PER_PAGE = 10;
    try {
      const { page = 1, search, startDate, endDate, sortBy } = req.query;
      let query = {
        userType: "bidder",
        isDeleted: false,
      };

      // If search parameter is provided, add it to the query
      if (search) {
        query.$or = [
          {
            userName: {
              $regex: new RegExp(search, "i"),
            },
          }, // Case-insensitive search for userName
          {
            name: {
              $regex: new RegExp(search, "i"),
            },
          }, // Case-insensitive search for name
          {
            email: {
              $regex: new RegExp(search, "i"),
            },
          }, // Case-insensitive search for email
          {
            mobile: {
              $regex: new RegExp(search, "i"),
            },
          }, // Case-insensitive search for mobile
        ];
      }
      if (startDate && endDate) {
        query.createdAt = {
          $gte: new Date(startDate + " 00:00:00"),
          $lte: new Date(endDate + " 23:59:00"),
        };
      }

      const totalItems = await User.countDocuments(query);
      const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

      let sortOptions = {
        createdAt: -1,
      }; // Default sorting by createdAt in descending order

      if (sortBy == 1) {
        // oldest to newest
        sortOptions = {
          createdAt: 1,
        };
      } else if (sortBy == 2) {
        // newest to oldest
        sortOptions = {
          createdAt: -1,
        };
      } else if (sortBy == 3) {
        // a to z at first
        sortOptions = {
          userName: 1,
        };
      } else if (sortBy == 4) {
        // z to a at last
        sortOptions = {
          userName: -1,
        };
      }

      const bidderlist = await User.find(query)
        .sort(sortOptions) // Sort by createdAt in descending order
        .skip((page - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE);

      // Check if data is empty
      if (bidderlist.length === 0) {
        return failed(res, "No seller found.", {});
      }

      return success(res, "bidders fetched successfully!", {
        bidderlist,
        pagination: {
          totalItems,
          totalPages,
          currentPage: page,
          itemsPerPage: ITEMS_PER_PAGE,
        },
      });
    } catch (error) {
      console.error(error);
      return serverError(res, "Internal Server Error");
    }
  },

  singleDetails: async (req, res) => {
    try {
      const userId = req.params.id;

      const user = await User.findById(userId);
      if (!user) {
        return failed(res, "User not found.", {});
      }

      return success(res, "User fetch Successfully!", user);
    } catch (error) {
      console.error(error);
      return serverError(res, "Internal Server Error");
    }
  },

  getsellersingleDetails: async (req, res) => {
    try {
      const userId = req.params.id;

      const user = await User.findById(userId);
      if (!user) {
        return failed(res, "User not found.", {});
      }

      // Fetch categories using the category IDs stored in the user document
      const categoryIds = user.categories.map(
        (category) => category.categoryId
      );
      const categories = await Category.find({
        _id: {
          $in: categoryIds,
        },
      });

      // category IDs with category names in the user object
      const userWithCategories = {
        ...user.toObject(),
        categories: categories.map((category) => ({
          categoryId: category._id,
          enName: category.enName,
          arName: category.arName,
        })),
        nationalIdCardImageUrl: user.nationalIdCardUrl,
      };

      return success(res, "User fetch Successfully!", userWithCategories);
    } catch (error) {
      console.error(error);
      return serverError(res, "Internal Server Error");
    }
  },

  profileCompleted: async (req, res) => {
    try {
      const v = new Validator(req.body, {
        userId: "required",
        profileStatus: "required|in:accept,reject",
        reason: "requiredIf:profileStatus,reject",
      });

      const matched = await v.check();
      if (!matched) {
        return validateFail(res, v);
      }

      const { userId, profileStatus, reason } = req.body;

      // Check if the user with the given userId exists
      const user = await User.findOne({
        _id: userId,
      });
      if (!user) {
        return failed(res, "User Not Found!", {});
      }

      let profileComplete;

      // Set the adminVerifyStatus based on the profileStatus
      if (profileStatus === "accept") {
        profileComplete = "Accepted";
        user.acceptedAt = new Date();
        let title = "Green House";
        let message = "Your account has been approved as a Seller.";
        await sendNewNotification(user._id, title, message);
      } else {
        profileComplete = "Rejected";
        user.rejectedReason = reason;
        user.rejectedAt = new Date();
        let title = "Green House";
        let message = "Your profile has been rejected by the admin.";
        await sendNewNotification(user._id, title, message);
      }

      // Update the user's adminVerifyStatus
      user.adminVerifyStatus = profileComplete;
      await user.save();

      return success(
        res,
        `User profile ${profileComplete} successfully!`,
        user
      );
    } catch (error) {
      console.error(error);
      return serverError(res, "Internal Server Error");
    }
  },

  statusChange: async (req, res) => {
    try {
      const v = new Validator(req.body, {
        status: "required",
        userId: "required",
      });

      const matched = await v.check();
      if (!matched) {
        return validateFail(res, v);
      }

      const { status, userId } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return failed(res, "User not found.", {});
      }
      let title = "Green House";
      let message;
      if (req.body.status == true) {
        message = "Your account is unblock.Please contact to admin.";
      } else if (req.body.status == false) {
        message = "Your account is blocked.Please contact to admin.";
      }
      await sendNewNotification(userId, title, message);

      // Update the user status
      user.status = status;
      await user.save();

      return success(res, "User status updated successfully!", user);
    } catch (error) {
      console.error(error);
      return serverError(res, "Internal Server Error");
    }
  },

  unblockSellerProfile: async (req, res) => {
    try {
      const v = new Validator(req.body, {
        userId: "required",
      });

      const matched = await v.check();
      if (!matched) {
        return validateFail(res, v);
      }

      const { userId } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return failed(res, "User not found.", {});
      }

      // Update the user status
      user.isDeleted = true;
      user.isAttemptCount = 0;
      await user.save();

      return success(res, "User Unblock successfully!", user);
    } catch (error) {
      console.error(error);
      return serverError(res, "Internal Server Error");
    }
  },
  //Bidder order details
  orderDetails: async (req, res) => {
    try {
      const { userId, type, page = 1, limit = 10 } = req.query;
      const id = new ObjectId(userId);
      let user;
      let totalCount = 0;

      if (type === "order") {
        const userData = await User.aggregate([
          { $match: { _id: id } },
          {
            $lookup: {
              from: "orders",
              localField: "_id",
              foreignField: "userId",
              as: "orderDetail",
            },
          },
          { $unwind: "$orderDetail" }, // Unwind the orderDetail array
          {
            $lookup: {
              from: "products",
              localField: "orderDetail.productId",
              foreignField: "_id",
              as: "productDetail",
            },
          },
          { $unwind: "$productDetail" },

          {
            $lookup: {
              from: "subcategories",
              localField: "productDetail.subCategoryId",
              foreignField: "_id",
              as: "subcategoryDetails",
            },
          },
          { $unwind: "$subcategoryDetails" },
          { $skip: (page - 1) * limit }, // Skip records based on page and limit
          { $limit: limit }, // Limit the number of records per page
        ]);

        let reqData = [];
        for (let i = 0; i < userData.length; i++) {
          const element = userData[i];
          const newData = {
            orderId: element.orderDetail.orderId,
            productImage:
              process.env.AWS_URL +
              element.productDetail.images[0].productImage,
            productName: element.subcategoryDetails.enName,
            orderStatus: element.orderDetail.orderStatus,
            boxCount: element.orderDetail.boxNumber,
            quantity: element.productDetail.quantity,
            unit: element.productDetail.unit,
            price: element.productDetail.price,
            endDate: element.productDetail.endDate,
            shippingMethod: element.orderDetail.shippingMethod,
            userName: element.userName,
          };
          reqData.push(newData);
        }
        user = reqData;

        // totalCount = await Order.countDocuments({ userId: id });
        // Count total orders for pagination
      } else if (type === "bid") {
        const userData = await User.aggregate([
          { $match: { _id: id } },
          {
            $lookup: {
              from: "bids",
              localField: "_id",
              foreignField: "userId",
              as: "bidDetail",
            },
          },
          {
            $lookup: {
              from: "orders",
              localField: "_id",
              foreignField: "userId",
              as: "orderDetail",
            },
          },
          { $unwind: "$orderDetail" },
          {
            $lookup: {
              from: "products",
              localField: "bidDetail.productId",
              foreignField: "_id",
              as: "productDetail",
            },
          },
          { $unwind: "$productDetail" },
          {
            $lookup: {
              from: "subcategories",
              localField: "productDetail.subCategoryId",
              foreignField: "_id",
              as: "subcategoryDetails",
            },
          },
          { $unwind: "$subcategoryDetails" },
          { $unwind: "$bidDetail" }, // Unwind the bidDetail array
          { $skip: (page - 1) * limit }, // Skip records based on page and limit
          { $limit: limit }, // Limit the number of records per page
        ]);
        let reqData = [];
        for (let i = 0; i < userData.length; i++) {
          const element = userData[i];
          // console.log(element);
          const newData = {
            orderId: element.orderDetail.orderId,
            productImage:
              process.env.AWS_URL +
              element.productDetail.images[0].productImage,
            productName: element.subcategoryDetails.enName,
            orderStatus: element.orderDetail.orderStatus,
            endDate: element.productDetail.endDate,
            bidPrice: element.bidDetail.amount,
            highestBidAmount: element.bidDetail.highestBidAmount,
          };
          reqData.push(newData);
        }
        user = reqData;
      }

      if (!user) {
        return failed(res, "User not found.", {});
      }
      totalCount = user.length;
      return success(res, "Data fetched successfully!", {
        user,
        totalCount,
      });
    } catch (error) {
      console.log({ error });
      return serverError(res, "Internal Server Error");
    }
  },

  //Seller order details
  sellerOrderDetails: async (req, res) => {
    try {
      const v = new Validator(req.query, {
        sellerId: "required",
      });

      const matched = await v.check();
      if (!matched) {
        return validateFail(res, v);
      }
      const { sellerId, type, page = 1, limit = 10 } = req.query;
      const id = new ObjectId(sellerId);
      let user;
      let totalCount = 0;

      if (type === "order") {
        const userData = await User.aggregate([
          { $match: { _id: id } },
          {
            $lookup: {
              from: "orders",
              localField: "_id",
              foreignField: "sellerId",
              as: "orderDetail",
            },
          },
          { $unwind: "$orderDetail" }, // Unwind the orderDetail array
          {
            $lookup: {
              from: "products",
              localField: "orderDetail.productId",
              foreignField: "_id",
              as: "productDetail",
            },
          },
          { $unwind: "$productDetail" },

          {
            $lookup: {
              from: "subcategories",
              localField: "productDetail.subCategoryId",
              foreignField: "_id",
              as: "subcategoryDetails",
            },
          },
          { $unwind: "$subcategoryDetails" },
          { $skip: (page - 1) * limit },
          { $limit: limit },
        ]);

        let reqData = [];
        for (let i = 0; i < userData.length; i++) {
          const element = userData[i];
          console.log({ element });
          const newData = {
            _id: element.orderDetail._id,

            orderId: element.orderDetail.orderId,
            productImage:
              process.env.AWS_URL +
              element.productDetail.images[0].productImage,
            productName: element.subcategoryDetails.enName,
            orderStatus: element.orderDetail.orderStatus,
            boxCount: element.orderDetail.boxNumber,
            quantity: element.productDetail.quantity,
            price: element.productDetail.price,
            productId: element.productDetail._id,
            shippingMethod: element.orderDetail.shippingMethod,
            userName: element.userName,
            address: element.address,
          };
          reqData.push(newData);
        }
        user = reqData;

        totalCount = await User.aggregate([
          { $match: { _id: id } },
          {
            $lookup: {
              from: "orders",
              localField: "_id",
              foreignField: "sellerId",
              as: "orderDetail",
            },
          },
          { $unwind: "$orderDetail" }, // Unwind the orderDetail array
          {
            $lookup: {
              from: "products",
              localField: "orderDetail.productId",
              foreignField: "_id",
              as: "productDetail",
            },
          },
          { $unwind: "$productDetail" },

          {
            $lookup: {
              from: "subcategories",
              localField: "productDetail.subCategoryId",
              foreignField: "_id",
              as: "subcategoryDetails",
            },
          },
          { $unwind: "$subcategoryDetails" },
        ]);
        totalCount = totalCount.length;
        // Count total orders for pagination
      } else if (type === "live") {
        const currentDate = new Date();
        console.log({ id });
        const userData = await User.aggregate([
          { $match: { _id: new ObjectId(id) } },
          {
            $lookup: {
              from: "products",
              localField: "_id",
              foreignField: "sellerId",
              as: "productDetails",
            },
          },
          { $unwind: "$productDetails" },
          {
            $lookup: {
              from: "orders",
              let: { sellerId: "$_id", productId: "$productDetails._id" },
              pipeline: [
                { $match: { $expr: { $eq: ["$sellerId", "$$sellerId"] } } },
                { $unwind: "$bids" },
                { $sort: { "bids.highestBidPrice": -1 } },
                { $limit: 1 },
                { $project: { highestBid: "$bids.highestBidPrice" } },
              ],
              as: "orderDetails",
            },
          },
          {
            $match: {
              $and: [
                { "productDetails.startDate": { $lte: currentDate } },
                { "productDetails.endDate": { $gte: currentDate } },
              ],
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
            $project: {
              productId: "$productDetails._id",
              quantity: "$productDetails.quantity",
              price: "$productDetails.price",
              startDate: "$productDetails.startDate",
              unit: "$productDetails.unit",
              endDate: "$productDetails.endDate",
              highestBid: { $arrayElemAt: ["$orderDetails.highestBid", 0] },
              subCategory: { $arrayElemAt: ["$subCategory", 0] },
              productImage: {
                $arrayElemAt: ["$productDetails.images.productImage", 0],
              },
            },
          },
          { $skip: (page - 1) * limit },
          { $limit: limit },
        ]);
        console.log({ userData });
        const reqData = userData.map((element) => ({
          subCategoryenName: element.subCategory?.enName || "",
          subCategoryarName: element.subCategory?.arName || "",
          highestBid: element.highestBid,
          quantity: element.quantity,
          price: element.price,
          unit: element.unit,
          endDate: element.endDate,
          startDate: element.startDate,
          productId: element.productId,
          productImage: element.productImage
            ? `${process.env.AWS_URL}${element.productImage}`
            : "",
        }));

        user = reqData;
        const totalCountAgg = await User.aggregate([
          { $match: { _id: new ObjectId(id) } },
          {
            $lookup: {
              from: "products",
              localField: "_id",
              foreignField: "sellerId",
              as: "productDetails",
            },
          },
          { $unwind: "$productDetails" },
          {
            $match: {
              $and: [
                { "productDetails.startDate": { $lte: currentDate } },
                { "productDetails.endDate": { $gte: currentDate } },
              ],
            },
          },
          { $count: "total" },
        ]);

        totalCount = totalCountAgg.length > 0 ? totalCountAgg[0].total : 0;
      }

      if (!user) {
        return failed(res, "User not found.", {});
      }
      totalCount = totalCount;
      return success(res, "Data fetched successfully!", {
        user,
        totalCount,
      });
    } catch (error) {
      console.log({ error });
      return serverError(res, "Internal Server Error");
    }
  },
  dashboard: async (req, res) => {
    try {
      const totalBidder = await User.countDocuments({
        userType: { $in: ["bidder"] },
      });
      const totalSeller = await User.countDocuments({
        userType: { $in: ["seller"] },
      });
      const totalOrder = await Order.countDocuments({
        orderStatus: "Delivered",
      });
      const activeBidder = await User.countDocuments({
        userType: { $in: ["bidder"] },
        status: true,
        isDeleted: false,
      });
      const activeSeller = await User.countDocuments({
        userType: { $in: ["seller"] },
        status: true,
        isDeleted: false,
      });
      const inActiveBidder = await User.countDocuments({
        userType: { $in: ["bidder"] },
        status: false,
        isDeleted: false,
      });
      const inActiveSeller = await User.countDocuments({
        userType: { $in: ["seller"] },
        status: false,
        isDeleted: false,
      });
      // Calculate total revenue for all time
      const totalRevenue = await Order.aggregate([
        { $match: { orderStatus: "Delivered" } },
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
      ]);
      const totalAmount =
        totalRevenue.length > 0 ? totalRevenue[0].totalAmount : 0;

      // Calculate weekly revenue for the past weeks
      const currentDate = moment();
      const weeks = [];
      for (let i = 0; i < 12; i++) {
        // Calculate revenue for the past 12 weeks (adjust as needed)
        const startDate = currentDate
          .clone()
          .subtract(i * 7, "days")
          .startOf("week")
          .toDate();
        const endDate = currentDate
          .clone()
          .subtract(i * 7 + 6, "days")
          .endOf("week")
          .toDate();

        // Calculate weekly revenue
        const weekRevenue = await Order.aggregate([
          {
            $match: {
              orderStatus: "Delivered",
              createdAt: { $gte: startDate, $lte: endDate },
            },
          },
          { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
        ]);

        const weekAmount =
          weekRevenue.length > 0 ? weekRevenue[0].totalAmount : 0;
        weeks.push({
          week: i + 1,
          startDate,
          endDate,
          totalAmount: weekAmount,
        });
      }

      const newData = {
        totalBidder,
        totalSeller,
        totalOrder,
        activeBidder,
        activeSeller,
        inActiveBidder,
        inActiveSeller,
        totalRevenue: totalAmount,
        weeklyRevenue: weeks.reverse(), // Reverse the array to start from the oldest week
      };

      return success(res, "Data fetched successfully.", newData);
    } catch (error) {
      console.error(error);
      return serverError(res, "Internal Server Error!");
    }
  },

  //Dashboard list
  dashboardList: async (req, res) => {
    try {
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
        { $match: { "product.endDate": { $gt: today } } }, // End date is greater than current date
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
        { $match: { "product.isDeleted": false, "product.status": true } }, // Filter products
        {
          $facet: {
            myBidData: [
              { $limit: 10 }, // Limit the number of documents based on pagination
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
                          { $eq: ["$highestBidAmount", "$amount"] },
                          { $lt: ["$product.endDate", today] },
                        ],
                      },
                      "won",
                      {
                        $cond: [
                          {
                            $and: [
                              { $ne: ["$amount", null] },
                              { $lt: ["$amount", "$highestBidAmount"] },
                              { $lt: ["$product.endDate", today] },
                            ],
                          },
                          "loss",
                          {
                            $cond: [
                              {
                                $and: [
                                  { $gt: ["$orderTimer", today] },
                                  { $eq: ["$amount", "$highestBidAmount"] },
                                  { $gt: ["$product.endDate", today] },
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
                  },
                },
              },
            ],
            totalCount: [{ $count: "count" }], // Count the total number of documents
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
      return success(res, "Data fetched successfully!", {
        myBidData,
        totalCount,
      });
    } catch (error) {
      console.log({ error });
      return serverError(res, "Internal Server Error");
    }
  },
};
