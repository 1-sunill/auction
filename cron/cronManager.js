const mongoose = require("mongoose");
const Orders = require("../app/Models/Order");
const Product = require("../app/Models/Product");
const Bid = require("../app/Models/Bid");
const User = require("../app/Models/User");
const Wallet = require("../app/Models/Wallet");

const moment = require("moment");
const {
  sendNotification,
  performWalletTransaction,
  sendNewNotification,
} = require("../helper/commonHelper");
// const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const ONE_MINUTE_IN_MS = 60 * 5000; // 1 minute in milliseconds

// Function to get user tokens
async function getUserTokens(userIds) {
  const users = await User.find({ _id: { $in: userIds } }).select(
    "deviceToken"
  );
  return users.map((user) => ({
    userId: user._id,
    token: user.deviceToken,
  }));
}
function generateTransactionId() {
  const randomNumber = Math.floor(Math.random() * 9000000000) + 1000000000; // Generate a random 9-digit number
  return randomNumber.toString(); // Convert the number to a string
}
// Define a common function to handle notifications
async function sendBidNotification(bidders, messageBody) {
  if (bidders.length > 0) {
    const userIds = bidders.map((item) => item.userId);
    const userTokens = await getUserTokens(userIds);
    const validUserTokens = userTokens.filter(
      (userToken) => userToken.token && userToken.token.trim() !== ""
    );

    const messages = validUserTokens.map((userToken) => ({
      token: userToken.token,
      body: messageBody,
    }));

    if (messages.length > 0) {
      await sendNotification(messages);
    }
  }
}

module.exports = {
  sendNotificationsEveryFiveMinutes: async () => {
    try {
      console.log("sendNotificationsEveryFiveMinutes");

      // Find orders packed in the last 5 minutes
      const fiveMinutesAgo = moment().subtract(5, "minutes").toISOString();
      const checkPackedUser = await Orders.find({
        orderStatus: "Packed",
        $or: [
          { lastNotifications: { $lt: fiveMinutesAgo } },
          { lastNotifications: null },
        ],
      });

      if (checkPackedUser.length === 0) {
        console.log("No packed orders in the last 5 minutes.");
        return;
      }

      // Update last send notification time
      for (let i = 0; i < checkPackedUser.length; i++) {
        const element = checkPackedUser[i];
        console.log({ element });
        await Orders.updateOne(
          { _id: element._id },
          { lastNotifications: new Date() }
        );
      }

      const userIds = checkPackedUser.map((item) => item.userId);
      const userTokens = await getUserTokens(userIds);
      const validUserTokens = userTokens.filter(
        (userToken) => userToken.token && userToken.token.trim() !== ""
      );

      const messageBody = "Please pickup your order.";
      const messages = validUserTokens.map((userToken) => ({
        token: userToken.token,
        body: messageBody,
      }));

      if (validUserTokens.length > 0) {
        await sendNotification(messages);
      }
    } catch (error) {
      console.error("Error in sendNotificationsEveryFiveMinutes:", error);
    }
  },

  //send notification in every 2 min
  sendNotificationsEveryTwoMinutes: async () => {
    try {
      const currentTime = moment().toISOString();
      const twentyMinutesAgo = moment().subtract(20, "minutes").toISOString();
      const twoMinutesAgo = moment().subtract(2, "minutes").toISOString();

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
                $project: {
                  highestBidAmount: 1,
                  userId: 1,
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

      for (const product of highestBids) {
        // console.log(product.myBidData);
        for (const data of product.myBidData) {
          if (data.bidStatus == "won" && data.orderPlaced == false) {
            const messageBody = "Please make your order.";
            // if (firstUserTokens != null) {
            await sendNewNotification(data.userId, messageBody);
            // }
          }
        }
      }
    } catch (error) {
      console.error("Error in sendOrderNotification:", error);
    }
  },

  //Feature bid
  featureProduct: async () => {
    try {
      // const currentDate = moment().add(1, "days").format("YYYY-MM-DD");
      const currentDate = moment().format("YYYY-MM-DD");

      const top10Bidders = await Bid.aggregate([
        {
          $addFields: {
            bidDateOnly: {
              $dateToString: { format: "%Y-%m-%d", date: "$biddingDate" },
            },
          },
        },
        {
          $match: {
            bidDateOnly: currentDate,
            bidType: "featured",
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
            sellerId: 1,
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
      console.log({ top10Bidders });
      let newTransaction;
      for (let i = 0; i < top10Bidders.length; i++) {
        const element = top10Bidders[i];
        const existingBid = parseFloat(element.amount);

        await Product.updateOne(
          { _id: element.productId },
          {
            $set: { isFeatured: true, rank: i + 1, featureBidAmt: existingBid },
          }
        );
        const user = await User.findOne({ _id: element.userId });

        if (!user) {
          console.error(`User with ID ${element.userId} not found`);
          continue;
        }
        console.log({ existingBid });
        console.log("user.freezedWalletAmount", user.freezedWalletAmount);
        const freezedAmt = Math.max(0, user.freezedWalletAmount - existingBid);
        // const totalAvailAmount = user.availableWalletAmount - freezedAmt;
        const totalAmount = freezedAmt + user.availableWalletAmount;

        await User.updateOne(
          { _id: element.userId },
          {
            freezedWalletAmount: freezedAmt,
            availableWalletAmount: user.availableWalletAmount,
            walletTotalAmount: totalAmount,
          }
        );
        const transactionId = generateTransactionId();

        newTransaction = await Wallet.create({
          userId: element.userId,
          transactionType: "debit",
          amount: element.amount,
          transactionSource: "Featured",
          transactionId: transactionId,
          subCategoryName: element.subCategoryName.enName,
          categoryName: "",
        });
        console.log({ newTransaction });
        // Set a timeout to revert isFeatured to false after 24 hours
        setTimeout(async () => {
          await Product.updateOne(
            { _id: element.productId },
            { $set: { isFeatured: false, rank: 0, featureBidAmt: 0 } }
          );
        }, ONE_MINUTE_IN_MS);
      }

      const top10BidderIds = top10Bidders.map((bid) => bid._id);

      const restBidders = await Bid.aggregate([
        {
          $addFields: {
            bidDateOnly: {
              $dateToString: { format: "%Y-%m-%d", date: "$biddingDate" },
            },
          },
        },
        {
          $match: {
            bidDateOnly: currentDate,
            bidType: "featured",
            _id: { $nin: top10BidderIds },
          },
        },
        {
          $sort: {
            amount: -1,
          },
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

      console.log("top10Bidders", top10Bidders);
      console.log("restBidders", restBidders);

      for (let i = 0; i < restBidders.length; i++) {
        const element = restBidders[i];
        const existingBid = parseFloat(element.amount);

        const user = await User.findOne({ _id: element.userId });

        if (!user) {
          console.error(`User with ID ${element.userId} not found`);
          continue;
        }

        const freezedAmt = Math.max(0, user.freezedWalletAmount - existingBid);
        const totalAvailAmount = Math.max(
          0,
          user.walletTotalAmount - freezedAmt
        );
        const totalAmount = totalAvailAmount + freezedAmt;

        await User.updateOne(
          { _id: element.userId },
          {
            freezedWalletAmount: freezedAmt,
            availableWalletAmount: totalAvailAmount,
            walletTotalAmount: totalAmount,
          }
        );
        const transactionId = generateTransactionId();

        newTransaction = await Wallet.create({
          userId: element.userId,
          transactionType: "credit",
          amount: element.amount,
          transactionSource: "Featured",
          transactionId: transactionId,
          subCategoryName: element.subCategoryName,
          categoryName: "",
        });
      }
      //Notification
      if (restBidders.length > 0) {
        await sendBidNotification(restBidders, "You have lost a feature bid.");
      }
      if (top10Bidders.length > 0) {
        await sendBidNotification(top10Bidders, "You have won a feature bid.");
      }
      // Delete the retrieved top 10 bidders
      for (let i = 0; i < top10Bidders.length; i++) {
        const element = top10Bidders[i];
        await Bid.deleteOne({ _id: element._id });
      }
      for (let i = 0; i < restBidders.length; i++) {
        const element = restBidders[i];
        await Bid.deleteOne({ _id: element._id });
      }
      return {
        top10Bidders,
        restBidders,
      };
    } catch (error) {
      console.error("Error in featureProduct:", error);
      throw error;
    }
  },
};
function generateTransactionId() {
  const randomNumber = Math.floor(Math.random() * 9000000000) + 1000000000; // Generate a random 9-digit number
  return randomNumber.toString(); // Convert the number to a string
}
