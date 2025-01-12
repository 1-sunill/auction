const { Validator } = require("node-input-validator");
const {
  serverError,
  validateFail,
  failed,
  success,
} = require("../../../helper/helper");
const FileUpload = require("../../../services/upload-files");
const User = require("../../../app/Models/User");
const AdminNotification = require("../../../app/Models/AdminNotification");
const Notification = require("../../../app/Models/Notification");
const moment = require("moment");
const firebase = require("firebase-admin");
var serviceAccount = require("../../../config/firebase1.json");
const {
  sendNotification,
  scheduleNotification,
} = require("../../../helper/commonHelper");
const schedule = require("node-schedule");
const schedulerFile = require("../../../schedule/schedule");

firebase.initializeApp({
  credential: firebase.credential.cert(serviceAccount),
});
async function getUserTokens(userIds) {
  // console.log({ userIds }); return 1;

  // Assuming you have a User model that stores tokens
  const users = await User.find({ _id: { $in: userIds } });
  return users.map((user) => ({
    userId: user._id,
    token: user.deviceToken, // Assuming 'notificationToken' is the field name
  }));
}
// Existing method for sending notifications
// const sendNotification = async (
//   userType,
//   title,
//   type,
//   message,
//   scheduleDate,
//   scheduleTime
// ) => {
//   try {
//     const notificationData = {
//       userType,
//       title,
//       type,
//       message,
//       scheduleDate,
//       scheduleTime,
//     };

//     // Check if both scheduleDate and scheduleTime are null
//     if (scheduleDate === null && scheduleTime === null) {
//       // Proceed without scheduling
//     } else {
//       const scheduleDateTime = new Date(scheduleDate + "T" + scheduleTime);
//       notificationData.scheduleDateTime = scheduleDateTime;
//     }

//     // Fetch all users with matching userType
//     const users = await User.find({ userType: { $in: userType } });

//     // Extract device tokens into an array
//     const tokens = users.reduce((acc, user) => {
//       if (user.deviceToken) {
//         acc.push(user.deviceToken);
//       }
//       return acc;
//     }, []);

//     // Process notifications in batches of 1000 tokens each
//     const batchSize = 1000;
//     for (let i = 0; i < tokens.length; i += batchSize) {
//       const batchTokens = tokens.slice(i, i + batchSize);

//       const nmessage = {
//         tokens: batchTokens,
//         notification: {
//           title: title,
//           body: message,
//         },
//         data: {
//           link: message ? message.toString() : "",
//           type: type.toString(),
//         },
//       };

//       // Send notifications using Firebase Admin SDK
//       // const response = await firebase.messaging().sendMulticast(nmessage);
//       // console.log("Batch notification sent:", response);
//     }
//     // Optional: Save notification data to database
//     const notification = await AdminNotification.create(notificationData);

//     // Add additional logic for sending notifications (e.g., push notifications, emails, etc.)

//     return notification;
//   } catch (error) {
//     console.error(error);
//     // return serverError(res, "Internal server error");
//   }
// };
module.exports = {
  getBidderSellerList: async (req, res) => {
    try {
      // Validate userType
      const v = new Validator(req.query, {
        userType: "required|in:bidder,seller",
      });

      const matched = await v.check();
      if (!matched) {
        return validateFail(res, v);
      }

      const userType = req.query.userType;

      let bidders = [];
      let sellers = [];

      if (userType === "bidder") {
        bidders = await User.find({ status: true });
      } else if (userType === "seller") {
        sellers = await User.find({
          status: true,
          isDeleted: false,
          adminVerifyStatus: "Accepted",
        });
      }

      const response = {
        bidders,
        sellers,
      };

      return success(
        res,
        "bidder and seller list retrieved successfully",
        response
      );
    } catch (error) {
      console.error(error);
      // return serverError(res, 'Internal server error');
    }
  },

  addNotification: async (req, res) => {
    try {
      const { userType, title, type, message, scheduletype, scheduleDate } =
        req.body;

      // Validate input
      const v = new Validator(req.body, {
        userType: "required|in:bidder,seller",
        title: "required|string",
        type: "required|in:0,1,2",
        // scheduleDate: "requiredIf:type,2",
        // scheduleTime: "requiredIf:type,2",
        message: "required|string",
      });

      const matched = await v.check();
      if (!matched) {
        return validateFail(res, v);
      }
      const users = await User.find({ userType: { $in: userType } });
      const userIds = users.map((user) => user._id.toString());

      const userTokens = await getUserTokens(userIds);
      const validUserTokens = userTokens.filter(
        (userToken) => userToken.token.trim() !== ""
      );
      // console.log("validUserTokens",validUserTokens)
      // Prepare the messages array for notifications
      const messageBody = req.body.message;
      const messages = validUserTokens.map((userToken) => ({
        token: userToken.token,
        title: req.body.title,
        body: messageBody,
        userId: userToken.userId,
      }));
      const newData = {
        userType: req.body.userType,
        title: req.body.title,
        message: req.body.message,
        scheduleDateTime: req.body.scheduleDate,
        type: req.body.type,
      };
      await AdminNotification.create(newData);
      // console.log({ validUserTokens });
      // return 1;
      if (type == 1) {
        if (validUserTokens.length > 0) {
          // Send the notifications
          await sendNotification(messages);
        }
      } else {
        //Schedule notification
        if (validUserTokens.length > 0) {
          // Send the notifications
          let sendDatetime = moment(scheduleDate); // Parse as a moment object
          sendDatetime = sendDatetime.add(5, "hours").add(30, "minutes");

          console.log("@@@@", sendDatetime.toDate());

          // return 1;
          await scheduleNotification(messages, sendDatetime.toDate());
        }
      }

      // Call the method to send notifications

      return success(res, "Notification added successfully");
    } catch (error) {
      console.error(error);
      return serverError(res, "Internal server error");
    }
  },

  getAdminNotifications: async (req, res) => {
    try {
      const v = new Validator(req.query, {
        type: "required|in:1,2",
        sort: "in:1,2,3,4",
      });

      const matched = await v.check();
      if (!matched) {
        return validateFail(res, v);
      }

      let { type, sort = 2, search = "", page = 1, pageSize = 10 } = req.query;

      page = parseInt(page);
      pageSize = parseInt(pageSize);

      const skipIndex = (page - 1) * pageSize;
      let sortCondition = { createdAt: -1 };

      if (sort == 1) {
        // oldest to newest
        sortCondition = { createdAt: 1 };
      } else if (sort == 2) {
        // newest to oldest
        sortCondition = { createdAt: -1 };
      } else if (sort == 3) {
        // a to z
        sortCondition = { title: 1 };
      } else if (sort == 4) {
        // z to a
        sortCondition = { title: -1 };
      }

      // Build the search condition
      let searchCondition = {};
      if (search.trim()) {
        searchCondition = { title: { $regex: new RegExp(search, "i") } };
      }

      // Retrieve total count of matching notifications
      const totalCount = await AdminNotification.countDocuments({
        type,
        ...searchCondition,
      });

      // Retrieve notifications based on type, search, and sort condition with pagination
      const notifications = await AdminNotification.find({
        type,
        ...searchCondition,
      })
        .sort(sortCondition)
        .skip(skipIndex)
        .limit(pageSize);

      const newData = {
        notifications,
        totalCount,
      };

      return success(
        res,
        "Admin notifications retrieved successfully",
        newData
      );
    } catch (error) {
      console.error(error);
      return serverError(res, "Internal server error");
    }
  },

  deleteNotification: async (req, res) => {
    try {
      const notificationId = req.params.id;
      console.log(notificationId);
      if (!notificationId) {
        return failed(res, "notificationId required");
      }
      const deletedNotification = await AdminNotification.findByIdAndRemove({
        _id: notificationId,
      });
      console.log({ deletedNotification });
      if (!deletedNotification) {
        return failed(res, "Data Not deleted");
      }
      return success(res, "Data deleted successfully!");
    } catch (error) {
      console.error(error);
      return serverError(res, "Internal Server Error");
    }
  },
};
