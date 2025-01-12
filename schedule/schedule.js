const mongoose = require("mongoose");
const { ObjectId } = require("mongodb");
const Bid = require("../app/Models/Bid");
const User = require("../app/Models/User");
const Order = require("../app/Models/Order");
const Product = require("../app/Models/Product");
const {
  sendNewNotification,
  performWalletTransaction,
} = require("../helper/commonHelper");

module.exports = {
  schedulerProcess: async (productId) => {
    console.log(
      "schedule working end Date++++++++++++++++++++++++++++++++++++++++++"
    );
    try {
      // Find all bids for the given product ID and bid type
      const bids = await Bid.find({
        productId,
        bidType: "purchase",
      });
      const productDetails = await Product.aggregate([
        {
          $match: {
            _id: new ObjectId(productId),
          },
        },
        {
          $lookup: {
            from: "subcategories",
            localField: "subCategoryId",
            foreignField: "_id",
            as: "subcategoriesDetail",
          },
        },
        {
          $unwind: "$subcategoriesDetail",
        }, // Unwind the resulting array from the lookup
      ]);
      // Loop through each bid and update its bidStatus
      for (const bid of bids) {
        let status;
        let title;
        let message;
        if (bid.highestBidAmount === bid.amount) {
          status = "won";
          title = "Green House";
          message = `You have won bidding for ${productDetails[0].subcategoriesDetail.enName}. Now you can place the order within 20 minutes`;
          await sendNewNotification(bid.userId, message, title);
        } else {
          status = "loss";
          title = "Green House";
          message = `You have lost the bidding on ${productDetails[0].subcategoriesDetail.enName}.`;
          await sendNewNotification(bid.userId, message, title);
          console.log("Vimmi trst new", productDetails[0]);

          //   console.log(bid.userId)
          //   await performWalletTransaction(
          //     bid.userId,
          //     "",
          //     bid.amount,
          //     1,
          //     "Loss auction"
          //   );
          const userDetails = await User.findOne({
            _id: bid.userId,
          });
          // if (bid.productId == productDetails[0]._id) {
          let freezAmt = userDetails.freezedWalletAmount - bid.amount;
          let availAmt = userDetails.availableWalletAmount + bid.amount;
          // let walletAmt = userDetails.walletTotalAmount + bid.amount;
          let walletAmt = freezAmt + availAmt;

          if (freezAmt < 0) {
            freezAmt = 0;
          }
          console.log({
            freezAmt,
          });

          await User.updateOne(
            {
              _id: bid.userId,
            },
            {
              freezedWalletAmount: freezAmt,
              availableWalletAmount: availAmt,
              walletTotalAmount: walletAmt,
            }
          );
          // }
        }

        // Update the bidStatus for the current bid
        await Bid.updateOne(
          {
            _id: bid._id,
          },
          {
            $set: {
              bidStatus: status,
            },
          }
        );
      }
      console.log("schedule cron working");
    } catch (error) {
      console.error("Error in schedulerProcess:", error);
      // Handle error appropriately
    }
  },

  missedSchedulerProcess: async (productId) => {
    console.log(
      " missedSchedulerProcess schedule working order timer Date++++++++++++++++++++++++++++++++++++++++++"
    );
    try {
      console.log(productId, "ds");
      const order = await Order.findOne({
        productId: new ObjectId(productId),
      });
      const productDetails = await Product.aggregate([
        {
          $match: {
            _id: new ObjectId(productId),
          },
        },
        {
          $lookup: {
            from: "subcategories",
            localField: "subCategoryId",
            foreignField: "_id",
            as: "subcategoriesDetail",
          },
        },
        {
          $unwind: "$subcategoriesDetail",
        }, // Unwind the resulting array from the lookup
      ]);

      if (order && order.orderPlaced) {
        console.log("if++++++++++++++++++++++++++++++++++++++++++");
      } else {
        // Find all bids for the given product ID and bid type
        const bids = await Bid.find({
          productId,
          bidType: "purchase",
        });

        // Loop through each bid and update its bidStatus
        for (const bid of bids) {
          let status;
          if (
            parseFloat(bid.amount) === parseFloat(bid.secondHighestBidAmount)
          ) {
            status = "won";
            title = "Green House";
            message = `You have won bidding for ${productDetails[0].subcategoriesDetail.enName}. Now you can place the order within 20 minutes`;
            await sendNewNotification(bid.userId, message, title);
            await Bid.updateOne(
              {
                _id: bid._id,
              },
              {
                $set: {
                  assignSecondHighestBidder: true,
                },
              }
            );
          }
          if (parseFloat(bid.highestBidAmount) === parseFloat(bid.amount)) {
            status = "missed";
            title = "Green House";
            message = `Won Bidding lost on ${productDetails[0].subcategoriesDetail.enName} as successful order doesn’t place within 20 minutes.`;
            await sendNewNotification(bid.userId, message, title);
            const userDetails = await User.findOne({
              _id: bid.userId,
            });
            // if (bid.productId == productDetails[0]._id) {
            let freezAmt = userDetails.freezedWalletAmount - bid.amount;
            let availAmt = userDetails.availableWalletAmount + bid.amount;
            // let walletAmt = userDetails.walletTotalAmount + bid.amount;
            let walletAmt = freezAmt + availAmt;

            if (freezAmt < 0) {
              freezAmt = 0;
            }
            console.log({
              freezAmt,
            });

            await User.updateOne(
              {
                _id: bid.userId,
              },
              {
                freezedWalletAmount: freezAmt,
                availableWalletAmount: availAmt,
                walletTotalAmount: walletAmt,
              }
            );
            // }
          }

          // Update the bidStatus for the current bid
          await Bid.updateOne(
            {
              _id: bid._id,
            },
            {
              $set: {
                bidStatus: status,
              },
            }
          );
        }
        console.log("schedule cron working");
      }
    } catch (error) {
      console.error("Error in schedulerProcess:", error);
      // Handle error appropriately
    }
  },

  secondOrderSchedulerProcess: async (productId) => {
    console.log(
      " secondOrderSchedulerProcess schedule working order timer Date++++++++++++++++++++++++++++++++++++++++++"
    );
    try {
      const order = await Order.findOne({
        productId,
      });
      if (order && order.orderPlaced) {
        console.log(" if++++++++++++++++++++++++++++++++++++++++++");
      } else {
        // Find all bids for the given product ID and bid type
        const bids = await Bid.find({
          productId,
          bidType: "purchase",
        });

        // Loop through each bid and update its bidStatus
        for (const bid of bids) {
          let status;
          if (
            parseFloat(bid.amount) === parseFloat(bid.secondHighestBidAmount)
          ) {
            status = "missed";
          }

          // Update the bidStatus for the current bid
          await Bid.updateOne(
            {
              _id: bid._id,
            },
            {
              $set: {
                bidStatus: status,
              },
            }
          );
        }
        console.log("schedule cron working");
      }
    } catch (error) {
      console.error("Error in schedulerProcess:", error);
      // Handle error appropriately
    }
  },
};
