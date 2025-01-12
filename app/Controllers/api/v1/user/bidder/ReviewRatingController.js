const { Validator } = require("node-input-validator");
const FileUpload = require("../../../../../../services/upload-files");
const bcrypt = require("bcrypt");
const i18n = require("i18n");
const mongoose = require("mongoose");
const { ObjectId } = require("mongodb");
const ReviewRating = require("../../../../../Models/ReviewRating");
const User = require("../../../../../../app/Models/User");

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

module.exports = {
  addUpdateReviewRating: async (req, res) => {
    try {
      var requests = await decrypter(req.body);

      if (requests === false) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      const v = new Validator(requests, {
        orderId: "required",
        sellerId: "required",
        rating: "required|numeric",
      });

      const matched = await v.check();
      if (!matched) {
        return failedValidation(res, v);
      }

      const userId = req.user._id;
      // Extract necessary data from the request
      const { orderId, rating, review, sellerId } = requests;
      if (rating < 1) {
        return failedValidation(res, "Please provide rating.");
      }
      let existingReviewRating = await ReviewRating.findOne({
        userId,
        orderId,
        sellerId,
      });

      if (existingReviewRating) {
        // existing ReviewRating document

        existingReviewRating.rating = rating;
        existingReviewRating.review = review;

        await existingReviewRating.save();

        var averageRating = await ReviewRating.aggregate([
          {
            $match: {
              orderId: new ObjectId(requests.orderId),
              sellerId: new ObjectId(requests.sellerId),
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
        const totalCount = averageRating.length;
        // Extract the average rating from the result
        averageRating =
          averageRating.length > 0 ? averageRating[0].averageRating : 0;
        await User.findByIdAndUpdate(new ObjectId(requests.sellerId), {
          totalRating: averageRating,
          totalUser: totalCount,
        });

        return response(res, 200, i18n.__("UPDATEDATA"));
      }
      // Create a new ReviewRating document
      const newReviewRating = new ReviewRating({
        userId: req.user._id,
        orderId,
        sellerId,
        rating,
        review,
      });

      // Save the new review rating
      await newReviewRating.save();

      var averageRating = await ReviewRating.aggregate([
        {
          $match: {
            orderId: new ObjectId(requests.productId),
            sellerId: new ObjectId(requests.sellerId),
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
      const totalCount = averageRating.length;
      // Extract the average rating from the result
      averageRating =
        averageRating.length > 0 ? averageRating[0].averageRating : 0;
      await User.findByIdAndUpdate(new ObjectId(requests.sellerId), {
        totalRating: averageRating,
        totalUser: totalCount,
      });
      // Respond with success message
      return response(res, 200, i18n.__("Added_Rating_Successfully"));
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },

  getReviews: async (req, res) => {
    try {
      // Decrypt the request body
      const requests = await decrypter(req.query);
      if (!requests) {
        return response(res, 500, i18n.__("Internal_Error"));
      }
  
      // Validate the decrypted request
      const v = new Validator(requests, {
        sellerId: "required",
        sortDirection: "in:asc,desc", // New validation for sort direction (optional)
      });
      const matched = await v.check();
      if (!matched) {
        return failedValidation(res, v);
      }
  
      const user = await User.findOne({
        _id: req.user._id,
      });
  
      if (!user) {
        return response(res, 422, i18n.__("NOTFOUND"));
      }
  
      let page = requests.page ? parseInt(requests.page) : 1; // ParseInt to ensure numeric value
      let pageSize = requests.limit ? parseInt(requests.limit) : 10; // ParseInt to ensure numeric value
      let skipIndex = (page - 1) * pageSize;
  
      // Default sorting by createdAt in descending order
      let sort = { createdAt: -1 };
  
      // If sortDirection is provided, sort by rating instead
      if (requests.sortDirection) {
        let sortDirection = requests.sortDirection === 'desc' ? -1 : 1; // Determine sort direction
        sort = { rating: sortDirection };
      }
  
      // Retrieve reviews associated with the authenticated user
      const userReviews = await ReviewRating.aggregate([
        {
          $match: {
            sellerId: new ObjectId(requests.sellerId),
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
          $unwind: "$user",
        },
        {
          $project: {
            _id: 1,
            userId: 1,
            sellerId: 1,
            rating: 1,
            review: 1,
            createdAt: 1,
            updatedAt: 1,
            userName: "$user.userName",
            name: "$user.name",
            profile_image: {
              $cond: {
                if: {
                  $ne: ["$user.profile_image", ""],
                },
                then: {
                  $concat: [process.env.AWS_URL, "$user.profile_image"],
                },
                else: "",
              },
            },
          },
        },
        {
          $sort: sort, // Apply sorting
        },
        {
          $skip: skipIndex, // Skip documents based on page number
        },
        {
          $limit: pageSize, // Limit documents per page
        },
      ]);
  
      var averageRating = await ReviewRating.aggregate([
        {
          $match: {
            sellerId: new ObjectId(requests.sellerId),
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
      const totalCount = averageRating.length;
      // Extract the average rating from the result
      averageRating =
        averageRating.length > 0 ? averageRating[0].averageRating : 0;
      averageRating = averageRating.toFixed(1);
      // Respond with the fetched reviews, average rating, and total count
      return response(res, 200, i18n.__("FETCHDATA"), {
        reviews: userReviews,
        averageRating: parseFloat(averageRating),
        totalCount: totalCount,
      });
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },
  
};
