const User = require("../app/Models/User");
const Wallet = require("../app/Models/Wallet");
const Notification = require("../app/Models/Notification");
const firebase = require("firebase-admin");
const { GoogleAuth } = require("google-auth-library");
const fetch = require("node-fetch");
const serviceAccount = require("../config/firebase1.json"); // Ensure this path is correct
const schedule = require("node-schedule");
// const moment = require("moment");
const moment = require("moment-timezone");
const jwt = require("jsonwebtoken");
const axios = require("axios");

// Initialize Firebase app if not already initialized
if (!firebase.apps.length) {
  firebase.initializeApp(
    {
      credential: firebase.credential.cert(serviceAccount),
    },
    "auctionApp"
  );
}

const PROJECT_ID = "green-house-dd3fe";
const MESSAGING_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const SCOPES = [MESSAGING_SCOPE];

async function getAccessToken() {
  const client = new GoogleAuth({
    credentials: serviceAccount,
    scopes: SCOPES,
  });
  const accessToken = await client.getAccessToken();
  return accessToken;
}

// token check
// getAccessToken()
//   .then((token) => {
//     console.log("Access Token:", token);
//   })
//   .catch((error) => {
//     console.error("Error getting access token:", error);
//   });

// exports.sendNotification = async (messages) => {
//   try {
//     const accessToken = await getAccessToken();

//     const totalChunks = Math.ceil(messages.length / 100);

//     for (let i = 0; i < totalChunks; i++) {
//       const chunkMessages = messages.slice(i * 100, (i + 1) * 100);

//       const responses = await Promise.all(
//         chunkMessages.map(async (message) => {
//           const notificationPayload = {
//             message: {
//               notification: {
//                 title: "Green House",
//                 body: message.body,
//               },
//               token: message.token,
//             },
//           };

//           const response = await fetch(
//             `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`,
//             {
//               method: "POST",
//               headers: {
//                 Authorization: `Bearer ${accessToken}`,
//                 "Content-Type": "application/json",
//               },
//               body: JSON.stringify(notificationPayload),
//             }
//           );

//           if (!response.ok) {
//             const error = await response.text();
//             throw new Error(`Error sending notification: ${error}`);
//           }

//           return response.json();
//         })
//       );

//       const successCount = responses.filter((res) => res.name).length;
//       const failureCount = responses.length - successCount;

//       console.log(
//         `Chunk ${
//           i + 1
//         }/${totalChunks} sent. Success count: ${successCount}, Failure count: ${failureCount}`
//       );

//       // Optional: Log failed messages for debugging
//       responses.forEach((resp, idx) => {
//         if (!resp.name) {
//           console.error(
//             `Failed to send notification to ${chunkMessages[idx].token}: ${resp.error}`
//           );
//         }
//       });
//     }

//     console.log("All bulk notifications sent successfully.");
//     return true; // Notification sent successfully
//   } catch (error) {
//     console.error("Error sending notifications:", error);
//     throw error; // Throw the error to be caught and handled by the caller
//   }
// };
exports.sendNotification = async (messages) => {
  try {
    const totalChunks = Math.ceil(messages.length / 100);

    for (let i = 0; i < totalChunks; i++) {
      const chunkMessages = messages.slice(i * 100, (i + 1) * 100);

      const tokens = chunkMessages.map((message) => message.token);

      const message = {
        notification: {
          title: chunkMessages[0].title,
          body: chunkMessages[0].body, // Assuming the body is the same for all messages in the chunk
        },
        tokens: tokens,
      };

      // Save notification data
      const newData = chunkMessages.map((message) => ({
        title: message.title,
        message: message.body,
        userId: message.userId,
      }));
      await Notification.create(newData);

      const response = await firebase.messaging().sendMulticast(message);

      console.log(`Chunk ${i + 1}/${totalChunks} sent. Response:`, response);

      if (response.failureCount > 0) {
        console.error(`${response.failureCount} messages failed to send`);
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.error(
              `Failed to send to ${chunkMessages[idx].token}: ${resp.error}`
            );
          }
        });
      }
    }

    console.log("All bulk notifications sent successfully.");
    return true;
  } catch (error) {
    console.error("Error sending notifications:", error);
    throw error;
  }
};

//Wallet management
exports.performWalletTransaction = async (
  userId,
  sellerId = null,
  amount,
  transactionType,
  transactionSource,
  transactionId = null,
  categoryName = null,
  highestBidPrice = 0
) => {
  try {
    console.log("+++++++++", userId);
    console.log("+++++++++", sellerId);
    console.log("+++++++++", amount);
    console.log("+++++++++", transactionType);
    console.log("+++++++++", transactionSource);
    console.log("+++++++++", transactionId);

    const user = await User.findById(userId);

    if (!user) {
      return null; // Or handle the case where the user is not found
    }

    const beforeWalletAmount = user.walletTotalAmount;
    const beforeWalletAvailAmount = user.availableWalletAmount;

    let afterWalletAmount;
    let afterWalletAvailAmount;

    switch (transactionType) {
      case 1: // Credit
        afterWalletAmount = parseFloat(beforeWalletAmount) + parseFloat(amount);
        afterWalletAvailAmount =
          parseFloat(beforeWalletAvailAmount) + parseFloat(amount);

        break;
      case 2: // Debit
        afterWalletAmount = parseFloat(beforeWalletAmount) - parseFloat(amount);
        if (highestBidPrice > 0) {
          afterWalletAvailAmount =
            parseFloat(beforeWalletAvailAmount) - parseFloat(highestBidPrice);
        }

        break;
      default:
        // Handle unknown transaction types
        throw new Error(`Unknown transactionType: ${transactionType}`);
    }

    let newTransaction;
    if (sellerId) {
      newTransaction = await Wallet.create({
        userId: userId,
        sellerId: sellerId,
        transactionType: transactionType === 1 ? "credit" : "debit",
        amount: amount,
        transactionSource: transactionSource,
        transactionId: transactionId,
        subCategoryName: transactionSource,
        categoryName: categoryName,
      });
    } else {
      newTransaction = await Wallet.create({
        userId: userId,
        transactionType: transactionType === 1 ? "credit" : "debit",
        amount: amount,
        transactionSource: transactionSource,
        transactionId: transactionId,
        subCategoryName: transactionSource,
        categoryName: categoryName,
      });
    }
    console.log("afterWalletAmount", afterWalletAmount);
    console.log("afterWalletAvailAmount", afterWalletAvailAmount);
    let availableAmt;
    let totalAmount;
    if (user.freezedWalletAmount == 0) {
      availableAmt = afterWalletAmount;
      totalAmount = availableAmt;
    } else {
      availableAmt = afterWalletAvailAmount;
      totalAmount = afterWalletAvailAmount + user.freezedWalletAmount;
    }
    await user.updateOne({
      walletTotalAmount: totalAmount,
      availableWalletAmount: availableAmt,
    });

    return newTransaction;
  } catch (error) {
    console.error(error);
    throw new Error("Error performing wallet transaction.");
  }
};

//Wallet management
exports.performSellerWalletTransaction = async (
  userId,
  sellerId = null,
  amount,
  transactionType,
  transactionSource,
  transactionId = null,
  categoryName = null
) => {
  try {
    console.log("+++++++++Seller", userId);
    console.log("+++++++++Seller", sellerId);
    console.log("+++++++++Seller", amount);
    console.log("+++++++++Seller", transactionType);
    console.log("+++++++++Seller", transactionSource);
    console.log("+++++++++Seller", transactionId);

    const user = await User.findById(sellerId);

    if (!user) {
      return null; // Or handle the case where the user is not found
    }

    const beforeWalletAmount = user.walletTotalAmount;
    const beforeWalletAvailAmount = user.availableWalletAmount;

    let afterWalletAmount;
    let afterWalletAvailAmount;

    switch (transactionType) {
      case 1: // Credit
        afterWalletAmount = parseFloat(beforeWalletAmount) + parseFloat(amount);
        afterWalletAvailAmount =
          parseFloat(beforeWalletAvailAmount) + parseFloat(amount);

        break;
      case 2: // Debit
        afterWalletAmount = parseFloat(beforeWalletAmount) - parseFloat(amount);
        afterWalletAvailAmount =
          parseFloat(beforeWalletAvailAmount) - parseFloat(amount);

        break;
      default:
        // Handle unknown transaction types
        throw new Error(`Unknown transactionType: ${transactionType}`);
    }

    let newTransaction = await Wallet.create({
      userId: sellerId,
      transactionType: transactionType === 1 ? "credit" : "debit",
      amount: amount,
      transactionSource: transactionSource,
      transactionId: transactionId,
      subCategoryName: transactionSource,
      categoryName: categoryName,
    });

    await user.updateOne({
      walletTotalAmount: afterWalletAmount,
      availableWalletAmount: afterWalletAvailAmount,
    });

    return newTransaction;
  } catch (error) {
    console.error(error);
    throw new Error("Error performing wallet transaction.");
  }
};

exports.walletTransaction = async (
  userId,
  sellerId = null,
  amount,
  transactionType,
  transactionSource,
  transactionId = null,
  categoryName = null
) => {
  try {
    console.log("+++++++++", userId);
    console.log("+++++++++", sellerId);
    console.log("+++++++++", amount);
    console.log("+++++++++", transactionType);
    console.log("+++++++++", transactionSource);
    console.log("+++++++++", transactionId);

    const user = await User.findById(userId);

    if (!user) {
      return null; // Or handle the case where the user is not found
    }

    const beforeWalletAmount = user.walletTotalAmount;
    const beforeWalletAvailAmount = user.availableWalletAmount;

    let afterWalletAmount;
    let afterWalletAvailAmount;

    switch (transactionType) {
      case 1: // Credit
        afterWalletAmount = parseFloat(beforeWalletAmount) + parseFloat(amount);
        afterWalletAvailAmount =
          parseFloat(beforeWalletAvailAmount) + parseFloat(amount);

        break;
      case 2: // Debit
        afterWalletAmount = parseFloat(beforeWalletAmount) - parseFloat(amount);
        afterWalletAvailAmount =
          parseFloat(beforeWalletAvailAmount) - parseFloat(amount);

        break;
      default:
        // Handle unknown transaction types
        throw new Error(`Unknown transactionType: ${transactionType}`);
    }

    let newTransaction;
    if (sellerId) {
      newTransaction = await Wallet.create({
        userId: userId,
        sellerId: sellerId,
        transactionType: transactionType === 1 ? "credit" : "debit",
        amount: amount,
        transactionSource: transactionSource,
        transactionId: transactionId,
        categoryName: categoryName,
      });
    } else {
      newTransaction = await Wallet.create({
        userId: userId,
        transactionType: transactionType === 1 ? "credit" : "debit",
        amount: amount,
        transactionSource: transactionSource,
        transactionId: transactionId,
        categoryName: categoryName,
      });
    }

    await user.updateOne({
      walletTotalAmount: afterWalletAmount,
      availableWalletAmount: afterWalletAvailAmount,
    });

    return newTransaction;
  } catch (error) {
    console.error(error);
    throw new Error("Error performing wallet transaction.");
  }
};
exports.sendNotificationForSecondHighest = async (
  receiverId,
  message,
  title = "Green House",
  bidId
) => {
  try {
    const accessToken = await getAccessToken();
    // console.log({ accessToken });
    const userDetails = await User.findOne({ _id: receiverId });

    if (!userDetails || !userDetails.deviceToken) {
      console.log("User details or FCM token not found");
      return false;
    }

    const notificationData = {
      userId: receiverId,
      message: message,
      title,
      bidId,
      secondHighestmsg: 1,
    };

    await Notification.create(notificationData);

    const { deviceToken } = userDetails;
    const payload = {
      message: {
        token: deviceToken,
        notification: {
          // sound: "default",
          title: title,
          body: message,
        },
        data: {
          type: "bid",
          bidId: bidId,
        },
      },
    };

    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error sending message: ${error}`);
    }

    const responseData = await response.json();
    console.log("Response:", responseData);
    return true;
  } catch (error) {
    console.log("Error sending notification:", error);
    return false;
  }
};
exports.sendNewNotification = async (
  receiverId,
  message,
  title = "Green House"
) => {
  try {
    const accessToken = await getAccessToken();
    // console.log({ accessToken });
    const userDetails = await User.findOne({ _id: receiverId });

    if (!userDetails || !userDetails.deviceToken) {
      console.log("User details or FCM token not found");
      return false;
    }

    const notificationData = {
      userId: receiverId,
      message: message,
      title,
    };

    await Notification.create(notificationData);

    const { deviceToken } = userDetails;
    const payload = {
      message: {
        token: deviceToken,
        notification: {
          // sound: "default",
          title: title,
          body: message,
        },
        data: {
          type: "message",
        },
      },
    };

    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error sending message: ${error}`);
    }

    const responseData = await response.json();
    console.log("Response:", responseData);
    return true;
  } catch (error) {
    console.log("Error sending notification:", error);
    return false;
  }
};
//For chat
exports.sendPushNotification = async (
  receiverId,
  title = "Green House",
  message
) => {
  try {
    const accessToken = await getAccessToken();
    // console.log({ accessToken });
    const userDetails = await User.findOne({ _id: receiverId });

    if (!userDetails || !userDetails.deviceToken) {
      console.log("User details or FCM token not found");
      return false;
    }

    const { deviceToken } = userDetails;
    const payload = {
      message: {
        token: deviceToken,
        notification: {
          // sound: "default",
          title: title,
          body: message,
        },
        data: {
          type: "message",
        },
      },
    };

    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error sending message: ${error}`);
    }

    const responseData = await response.json();
    console.log("Response:", responseData);
    return true;
  } catch (error) {
    console.log("Error sending notification:", error);
    return false;
  }
};
exports.scheduleNotification = async (messages, scheduledDate) => {
  try {
    // Adjust scheduledDate by adding 5 hours and 30 minutes
    const adjustedDate = moment(scheduledDate)
      .subtract(5, "hours")
      .subtract(30, "minutes");
    // Schedule the job
    const job = schedule.scheduleJob(adjustedDate.toDate(), async () => {
      try {
        console.log("Scheduled job running at", new Date());

        const accessToken = await getAccessToken();
        const totalChunks = Math.ceil(messages.length / 100);

        for (let i = 0; i < totalChunks; i++) {
          const chunkMessages = messages.slice(i * 100, (i + 1) * 100);

          const responses = await Promise.all(
            chunkMessages.map(async (message) => {
              const notificationPayload = {
                message: {
                  notification: {
                    title: message.title,
                    body: message.body,
                  },
                  token: message.token,
                },
              };
              const newData = {
                title: message.title,
                message: message.body,
                userId: message.userId,
              };
              await Notification.create(newData);
              try {
                const response = await fetch(
                  `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`,
                  {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${accessToken}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify(notificationPayload),
                  }
                );

                if (!response.ok) {
                  const error = await response.json();
                  if (
                    error.error.details &&
                    error.error.details[0].errorCode === "UNREGISTERED"
                  ) {
                    console.error(
                      `Token ${message.token} is unregistered. Removing from database.`
                    );
                    // Example: removeTokenFromDatabase(message.token);
                  } else {
                    console.error(
                      `Error sending notification to ${
                        message.token
                      }: ${JSON.stringify(error)}`
                    );
                  }
                  return { success: false };
                }

                const responseData = await response.json();
                return { success: true, response: responseData };
              } catch (err) {
                console.error(
                  `Error sending notification to ${message.token}: ${err.message}`
                );
                return { success: false };
              }
            })
          );

          const successCount = responses.filter((res) => res.success).length;
          const failureCount = responses.length - successCount;

          console.log(
            `Chunk ${
              i + 1
            }/${totalChunks} sent. Success count: ${successCount}, Failure count: ${failureCount}`
          );

          // Optional: Log failed messages for debugging
          responses.forEach((resp, idx) => {
            if (!resp.success) {
              console.error(
                `Failed to send notification to ${chunkMessages[idx].token}`
              );
            }
          });
        }

        console.log("All bulk notifications sent successfully.");
      } catch (error) {
        console.error("Error sending notifications:", error);
        throw error;
      }
    });

    if (job) {
      console.log(`Job scheduled successfully with name: ${job.name}`);
    } else {
      console.error("Failed to schedule job. Job is null.");
    }

    return job ? job.name : null;
  } catch (error) {
    console.error("Error scheduling notifications:", error);
    throw error;
  }
};

exports.makeApiCall = async (url, method, headers, data) => {
  try {
    const config = {
      method: method,
      maxBodyLength: Infinity,
      url: url,
      headers: headers,
      data: data,
    };

    const response = await axios.request(config);
    return response.data;
  } catch (error) {
    return  error.response.data.errors
    console.log("++++", error.response.data.errors );
    throw new Error(error);
  }
};
