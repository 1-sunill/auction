const { Validator } = require("node-input-validator");
const FileUpload = require("../../../../../../services/upload-files");
const bcrypt = require("bcrypt");
const i18n = require("i18n");
const mongoose = require("mongoose");
const { ObjectId } = require("mongodb");
const Product = require("../../../../../Models/Product");
const Category = require("../../../../../Models/Category");
const SubCategory = require("../../../../../Models/SubCategory");
const Bid = require("../../../../../Models/Bid");
const WishList = require("../../../../../Models/WishList");
const User = require("../../../../../Models/User");
const moment = require("moment");
const randf = require("randomstring");
const schedule = require("node-schedule");
const schedulerFile = require("../../../../../../schedule/schedule");
const momentnew = require("moment-timezone");
const Commission = require("../../../../../Models/Comission");
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
const { orderPacked } = require("./OrderController");
const Order = require("../../../../../Models/Order");
const {
  sendNewNotification,
  sendNotification,
} = require("../../../../../../helper/commonHelper");
require("dotenv").config();

const timezones = {
  SAUDI_ARABIA: process.env.TIMEZONE_SAUDI_ARABIA,
  INDIA: process.env.TIMEZONE_INDIA,
};
async function getUserTokens(userIds) {
  // Assuming you have a User model that stores tokens
  const users = await User.find({ _id: { $in: userIds } }).select(
    "deviceToken"
  );
  return users.map((user) => ({
    userId: user._id,
    token: user.deviceToken, // Assuming 'notificationToken' is the field name
  }));
}
module.exports = {
  // Add product
  addProduct: async (req, res) => {
    try {
      // console.log("++++++++++++++++++++++++++++ call add product", req.body);
      // Decrypt the request body
      var requests = await decrypter(req.body);
      // console.log("++++++++++++++++++++++++++++ call add product", requests);

      if (requests === false) {
        return response(res, 500, i18n.__("Internal_Error"));
      }
      const userId = req.user._id;

      const wishList = await WishList.find({
        "sellers.sellerId": new ObjectId(userId),
      }).select("userId");

      // console.log({ userId });
      const userIds = wishList.map((item) => item.userId);

      // Extract the userId from the results
      const userTokens = await getUserTokens(userIds);
      const validUserTokens = userTokens.filter(
        (userToken) => userToken.token.trim() !== ""
      );

      // Prepare the messages array for notifications
      const messageBody = "Your fav seller add new product.";
      const messages = validUserTokens.map((userToken) => ({
        token: userToken.token,
        body: messageBody,
      }));
      console.log({ validUserTokens });
      if (validUserTokens.length > 0) {
        // Send the notifications
        await sendNotification(messages);
      }

      // return 1;
      // Validate the decrypted request
      const v = new Validator(requests, {
        categoryId: "required",
        subCategoryId: "required",
        quantity: "required",
        unit: "required",
        price: "required",
        description: "required",
        mobile: "required",
        countryCode: "required",
        productLocation: "required",
        startDate: "required|date",
        endDate: "required|date",
        startTime: "required",
        endTime: "required",
        lat: "required",
        long: "required",
        country: "required",
      });

      const matched = await v.check();
      if (!matched) {
        return failedValidation(res, v);
      }

      //Start date and End Date
      let today = new Date();
      console.log("current", today);
      console.log({ requests });
      const next1Days = new Date();
      next1Days.setDate(today.getDate() + 1);

      const next7Days = new Date();
      next7Days.setDate(today.getDate() + 7);

      const next30Days = new Date();
      next30Days.setDate(today.getDate() + 30);
      let todayDate = moment(today).format("YYYY-MM-DD");
      let nextDate = moment(next1Days).format("YYYY-MM-DD");
      let nextSevenDay = moment(next7Days).format("YYYY-MM-DD");
      let nextThirtyDay = moment(next30Days).format("YYYY-MM-DD");

      const startDateReq = moment(requests.startDate).format("YYYY-MM-DD");
      const endDateReq = moment(requests.endDate).format("YYYY-MM-DD");

      // if (!moment(startDateReq).isSameOrBefore(moment(nextSevenDay))) {
      //     return response(res, 422, i18n.__('StartDate_lessthan_7days'));
      // } else if (!moment(startDateReq).isSameOrAfter(moment(nextDate))) {
      //     return response(res, 422, i18n.__('StartDate_greaterthan_today'));
      // }

      // if (!moment(endDateReq).isSameOrBefore(moment(nextThirtyDay))) {
      //     return response(res, 422, i18n.__('EndDate_lessequal_30Days'));
      // } else if (!moment(endDateReq).isSameOrAfter(moment(nextDate))) {
      //     return response(res, 422, i18n.__('EndDate_greaterthan_today'));
      // } else if (!moment(endDateReq).isSameOrAfter(startDateReq)) {
      //     return response(res, 422, i18n.__('EndDate_greaterthanequal_StartDate'));
      // }

      // if (!moment(requests.endTime, 'HH:mm').isSameOrBefore(moment('10:30', 'HH:mm'))) {
      //     return response(res, 422, i18n.__('EndTime_lessthanequal_10_30_AM'));
      // }

      // if (moment(endDateReq).isSame(startDateReq) && !moment(requests.endTime, 'HH:mm').isAfter(moment(requests.startTime, 'HH:mm'))) {
      //     return response(res, 422, i18n.__('EndTime_greaterthan_StartTime'));
      // }

      // Check if the specified category exists or not
      const categoryExists = await Category.findById(requests.categoryId);
      if (!categoryExists) {
        return response(res, 422, i18n.__("category_not_Exist"));
      }

      // Check if the specified subCategory exists or not
      const subCategoryExists = await SubCategory.findById(
        requests.subCategoryId
      );
      if (!subCategoryExists) {
        return response(res, 422, i18n.__("subcategory_not_Exist"));
      }

      if (!req.files) {
        return response(res, 422, i18n.__("File_required"));
      }

      // Upload product images
      const uploadedImages = [];
      if (Array.isArray(req.files.images)) {
        // If multiple images are uploaded
        for (const image of req.files.images) {
          const uploadedFile = await FileUpload.aws(image, "ProductImage");
          uploadedImages.push(uploadedFile.Key);
        }
      } else {
        // console.log("+++++++++",req.files.file)
        // If only one image is uploaded
        const uploadedFile = await FileUpload.aws(
          req.files.images,
          "ProductImage"
        );

        uploadedImages.push(uploadedFile.Key);
      }
      const endTime = requests.endTime ? requests.endTime : "10:30";
      const timezone = timezones[requests.country];
      let startDateTime;
      let endDateTime;
      if (requests.country == "Asia/Riyadh") {
        startDateTime = moment
          .tz(
            requests.startDate + "T" + requests.startTime,
            process.env.TIMEZONE_SAUDI_ARABIA
          )
          .toDate();
        endDateTime = moment
          .tz(
            requests.endDate + "T" + endTime,
            process.env.TIMEZONE_SAUDI_ARABIA
          )
          .toDate();
      } else if (
        requests.country == "Asia/Kolkata" ||
        requests.country == "Asia/Calcutta"
      ) {
        startDateTime = moment
          .tz(
            requests.startDate + "T" + requests.startTime,
            process.env.TIMEZONE_INDIA
          )
          .toDate();
        endDateTime = moment
          .tz(requests.endDate + "T" + endTime, process.env.TIMEZONE_INDIA)
          .toDate();
      }

      // const startDateTime = new Date(
      //   requests.startDate + "T" + requests.startTime
      // );
      // const endDateTime = new Date(requests.endDate + "T" + endTime);
      console.log("startDateTime#######", startDateTime);
      console.log("endDateTime++++++++++++++", endDateTime);

      const latitude = parseFloat(requests.lat) ? parseFloat(requests.lat) : 0;
      const longitude = parseFloat(requests.long)
        ? parseFloat(requests.long)
        : 0;

      const OrderTimer = moment(endDateTime).add(20, "minutes").toISOString();
      const secondOrderTimer = moment(OrderTimer)
        .add(20, "minutes")
        .toISOString();
      console.log(OrderTimer, "asd");

      var at = new Date();
      var jobId = at.getTime() + randf.generate(10) + "END"; //randomsrting
      var jobOrderId = at.getTime() + randf.generate(10) + "ORD"; //randomsrting
      var jobSecondOrderId = at.getTime() + randf.generate(10) + "SBORD"; //randomsrting

      const checkSubcategoryIsExist = await Product.findOne({
        subCategoryId: requests.subCategoryId,
      });

      if (!checkSubcategoryIsExist) {
        const allBidders = await User.find({
          status: true,
          isDeleted: false,
          _id: { $ne: req.user._id },
        });

        const bidderIds = allBidders.map((item) => item._id);

        // Extract the userId from the results
        const bidderTokens = await getUserTokens(bidderIds);
        const validBidderTokens = bidderTokens.filter(
          (bidderToken) => bidderToken.token.trim() !== ""
        );

        // Prepare the messages array for notifications
        const messageBody = "Seller added a new product.";
        const bidderMessages = validBidderTokens.map((userToken) => ({
          token: userToken.token,
          body: messageBody,
        }));

        console.log({ validBidderTokens });

        if (validBidderTokens.length > 0) {
          // Send the notifications
          await sendNotification(bidderMessages);
        }
      }

      // Create new Product instance
      const newProduct = new Product({
        sellerId: req.user._id,
        categoryId: requests.categoryId,
        subCategoryId: requests.subCategoryId,
        quantity: requests.quantity,
        unit: requests.unit,
        price: requests.price,
        description: requests.description,
        mobile: requests.mobile,
        countryCode: requests.countryCode,
        productLocation: requests.productLocation,
        location: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
        startDate: startDateTime,
        endDate: endDateTime,
        orderTimer: OrderTimer,
        secondOrderTimer: secondOrderTimer,
        startTime: requests.startTime,
        endTime: requests.endTime ? requests.endTime : "10:30",
        scheduleId: jobId,
        orderScheduleId: jobOrderId,
        secondOrderScheduleId: jobSecondOrderId,
        images: uploadedImages.map((image) => ({ productImage: image })),
      });

      // Save the new product to the database
      const savedProduct = await newProduct.save();

      // var time = at.setSeconds(at.getSeconds() + Number(5))  //after 5 second
      var job = schedule.scheduleJob(
        jobId,
        new Date(savedProduct.endDate),
        function () {
          schedulerFile.schedulerProcess(savedProduct._id);
          console.log("hi--viral", savedProduct._id);
        }
      );

      //  var time = at.setSeconds(at.getSeconds() + Number(5))  //after 5 second
      var job = schedule.scheduleJob(
        jobOrderId,
        new Date(savedProduct.orderTimer),
        function () {
          schedulerFile.missedSchedulerProcess(savedProduct._id);
          console.log("hi--viral", savedProduct._id);
        }
      );

      var job = schedule.scheduleJob(
        jobSecondOrderId,
        new Date(savedProduct.secondOrderTimer),
        function () {
          schedulerFile.secondOrderSchedulerProcess(savedProduct._id);
          console.log("hi--viral", savedProduct._id);
        }
      );

      // Respond with success
      return success(res, i18n.__("Prod_Added_Successfully"), savedProduct);
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },
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
      let address = requests.address ? requests.address : "";
      let remainingHours = requests.remainingHours
        ? parseInt(requests.remainingHours)
        : "";

      // Define search parameters for products
      let params = {
        sellerId: new ObjectId(req.user._id),
        endDate: { $gte: new Date() },
        isDeleted: false,
        status: true,
      };
      if (remainingHours && remainingHours != "") {
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
      //   if (address && address != "") {
      //     params.productLocation = address;
      //   }

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
            { "subCategory.enName": { $regex: searchnew, $options: "i" } },
            { "subCategory.arName": { $regex: searchnew, $options: "i" } },
          ],
        });
      }
      let latitude = parseFloat(requests.lat);
      let longitude = parseFloat(requests.long);
      console.log("Request All", requests);
      let geoNearStage = { $match: {} };
      // // Check if valid coordinates are provided
      if (!isNaN(latitude) && !isNaN(longitude)) {
        geoNearStage = {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [longitude, latitude],
            },
            key: "location",
            distanceField: "totalDistance",
            spherical: true,
            maxDistance: 100 * 1000, // 100 km in meters
          },
        };
      }
      console.log("geoNearStage", geoNearStage);
      // Aggregate query to get products and total count using $facet
      const result = await Product.aggregate([
        geoNearStage,
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
        { $match: params },
        {
          $lookup: {
            from: "bids",
            let: { productId: "$_id", subCategoryId: "$subCategoryId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$subCategoryId", "$$subCategoryId"] },
                      { $eq: ["$productId", "$$productId"] },
                      {
                        $eq: [
                          {
                            $dateToString: {
                              format: "%Y-%m-%d",
                              date: "$biddingDate",
                            },
                          },
                          moment().format("YYYY-MM-DD"),
                        ],
                      },
                      { $eq: ["$userId", new ObjectId(req.user._id)] },
                    ],
                  },
                },
              },
              {
                $sort: { amount: -1 },
              },
              {
                $limit: 1,
              },
            ],
            as: "featured",
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
            bidCount: {
              $size: {
                $filter: {
                  input: "$allBids",
                  as: "bid",
                  cond: { $eq: ["$$bid.bidType", "purchase"] },
                },
              },
            },
          },
        },
        { $sort: { createdAt: -1 } },
        {
          $facet: {
            products: [
              { $skip: skipIndex },
              { $limit: pageSize },
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
                  location: 1,
                  isFeatured: 1,
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
                  // isFeatured: {
                  //   $cond: {
                  //     if: { $gt: [{ $size: "$featured" }, 0] },
                  //     then: true,
                  //     else: false,
                  //   },
                  // },
                  bidCount: 1, // Include bidCount in the projection
                },
              },
            ],
            totalCount: [{ $count: "count" }],
          },
        },
      ]);

      const products = result[0].products;
      const totalCount =
        result[0].totalCount.length > 0 ? result[0].totalCount[0].count : 0;
      const adminComminsion = await Commission.find();
      return success(res, i18n.__("FETCHDATA"), {
        products,
        count: totalCount,
        adminComminsion: adminComminsion[0].commission,
      });
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },

  //Edit Product Only Date And Time
  editProduct: async (req, res) => {
    try {
      // Decrypt the request body
      var requests = await decrypter(req.body);
      if (requests === false) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      // Validate the decrypted request
      const v = new Validator(requests, {
        productId: "required", // Assuming productId is the unique identifier for the product
        startDate: "required|date",
        endDate: "required|date",
        startTime: "required",
        endTime: "required",
        country: "required",
      });
      const matched = await v.check();
      if (!matched) {
        return failedValidation(res, v);
      }

      //Start date and End Date
      let today = new Date();
      console.log("current", today);

      const next1Days = new Date();
      next1Days.setDate(today.getDate() + 1);

      const next7Days = new Date();
      next7Days.setDate(today.getDate() + 7);

      const next30Days = new Date();
      next30Days.setDate(today.getDate() + 30);
      let todayDate = moment(today).format("YYYY-MM-DD");
      let nextDate = moment(next1Days).format("YYYY-MM-DD");
      let nextSevenDay = moment(next7Days).format("YYYY-MM-DD");
      let nextThirtyDay = moment(next30Days).format("YYYY-MM-DD");

      const startDateReq = moment(requests.startDate).format("YYYY-MM-DD");
      const endDateReq = moment(requests.endDate).format("YYYY-MM-DD");

      if (!moment(startDateReq).isSameOrBefore(moment(nextSevenDay))) {
        return response(res, 422, i18n.__("StartDate_lessthan_7days"));
      } else if (!moment(startDateReq).isSameOrAfter(moment(nextDate))) {
        return response(res, 422, i18n.__("StartDate_greaterthan_today"));
      }

      if (!moment(endDateReq).isSameOrBefore(moment(nextThirtyDay))) {
        return response(res, 422, i18n.__("EndDate_lessequal_30Days"));
      } else if (!moment(endDateReq).isSameOrAfter(moment(nextDate))) {
        return response(res, 422, i18n.__("EndDate_greaterthan_today"));
      } else if (!moment(endDateReq).isSameOrAfter(startDateReq)) {
        return response(
          res,
          422,
          i18n.__("EndDate_greaterthanequal_StartDate")
        );
      }

      if (
        !moment(requests.endTime, "HH:mm").isSameOrBefore(
          moment("10:30", "HH:mm")
        )
      ) {
        return response(res, 422, i18n.__("EndTime_lessthanequal_10_30_AM"));
      }

      // Find the existing product by productId
      let existingProduct = await Product.findById(requests.productId);
      if (!existingProduct) {
        return response(res, 422, i18n.__("NOTFOUND"));
      }

      const endTime = requests.endTime ? requests.endTime : "10:30";
      // const startDateTime = moment(
      //   requests.startDate + "T" + requests.startTime,
      //   "YYYY-MM-DDTHH:mm"
      // ).toDate();

      // const endDateTime = new Date(requests.endDate + "T" + endTime);

      let startDateTime;
      let endDateTime;
      if (requests.country == "Asia/Riyadh") {
        startDateTime = moment
          .tz(
            requests.startDate + "T" + requests.startTime,
            process.env.TIMEZONE_SAUDI_ARABIA
          )
          .toDate();
        endDateTime = moment
          .tz(
            requests.endDate + "T" + endTime,
            process.env.TIMEZONE_SAUDI_ARABIA
          )
          .toDate();
      } else if (requests.country == "Asia/Kolkata") {
        startDateTime = moment
          .tz(
            requests.startDate + "T" + requests.startTime,
            process.env.TIMEZONE_INDIA
          )
          .toDate();
        endDateTime = moment
          .tz(requests.endDate + "T" + endTime, process.env.TIMEZONE_INDIA)
          .toDate();
      }

      const OrderTimer = moment(endDateTime).add(20, "minutes").toISOString();
      const secondOrderTimer = moment(OrderTimer)
        .add(20, "minutes")
        .toISOString();

      if (!moment(existingProduct.endDate).isSame(endDateTime)) {
        schedule.cancelJob(existingProduct.scheduleId);
        schedule.cancelJob(existingProduct.orderScheduleId);
        var at = new Date();
        var jobId = at.getTime() + randf.generate(10) + "END"; //randomsrting
        var jobOrderId = at.getTime() + randf.generate(10) + "ORD"; //randomsrting
        var jobSecondOrderId = at.getTime() + randf.generate(10) + "SBORD"; //randomsrting

        var job = schedule.scheduleJob(
          jobId,
          new Date(endDateTime),
          function () {
            schedulerFile.schedulerProcess(existingProduct._id);
            console.log("hi--viral", existingProduct._id);
          }
        );

        //  var time = at.setSeconds(at.getSeconds() + Number(5))  //after 5 second
        var job = schedule.scheduleJob(
          jobOrderId,
          new Date(OrderTimer),
          function () {
            schedulerFile.missedSchedulerProcess(existingProduct._id);
            console.log("hi--viral", existingProduct._id);
          }
        );

        var job = schedule.scheduleJob(
          jobSecondOrderId,
          new Date(secondOrderTimer),
          function () {
            schedulerFile.missedSchedulerProcess(existingProduct._id);
            console.log("hi--viral", existingProduct._id);
          }
        );
      }

      // Update the startDate, endDate, startTime, and endTime fields
      existingProduct.startDate = startDateTime.toISOString();
      existingProduct.endDate = endDateTime.toISOString();
      existingProduct.orderTimer = OrderTimer;
      existingProduct.secondOrderTimer = secondOrderTimer;
      existingProduct.startTime = requests.startTime;
      existingProduct.scheduleId = jobId ? jobId : existingProduct.scheduleId;
      existingProduct.orderScheduleId = jobOrderId
        ? jobOrderId
        : existingProduct.orderScheduleId;
      existingProduct.secondOrderScheduleId = jobOrderId
        ? jobSecondOrderId
        : existingProduct.jobSecondOrderId;
      existingProduct.endTime = requests.endTime ? requests.endTime : "10:30";
      // Save the updated product
      const product = await existingProduct.save();

      const order = await Order.findOne({ productId: requests.productId });
      const bids = await Bid.find({ productId: requests.productId });
      // Delete each order
      if (order) {
        await Order.findByIdAndDelete(order._id);
      }
      for (const bid of bids) {
        await Bid.findByIdAndDelete(bid._id);
      }

      // Respond with success
      return success(res, i18n.__("UPDATEDATA"), { product });
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },

  //SingleProduct Deatails APi
  singleProductDetails: async (req, res) => {
    try {
      // Decrypt the request body
      var requests = await decrypter(req.query);
      if (requests === false) {
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
        // .select("isFeatured categoryId subCategoryId")
        .populate("categoryId", "enName arName")
        .populate("subCategoryId", "enName arName");

      if (!product) {
        return response(res, 422, i18n.__("NOTFOUND"));
      }

      const currentDate = moment().format("YYYY-MM-DD");

      // Find the highest featured bid for the product on the same date
      const highestFeaturedBid = await Bid.findOne({
        productId: requests.productId,
        biddingDate: currentDate, // biddingDate is equal to today's date
      }).sort({ amount: -1 });

      const isFeatured = highestFeaturedBid ? "true" : "false";

      // product.isFeatured = isFeatured;

      // Respond with the fetched product
      return success(res, i18n.__("FETCHDATA"), { product });
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },
  deleteProduct: async (req, res) => {
    try {
      var requests = await decrypter(req.query);
      if (requests == false) {
        return response(res, 500, i18n.__("Internal_Error"));
      }
      const v = new Validator(requests, {
        productId: "required",
      });
      const matched = await v.check();
      if (!matched) {
        return failedValidation(res, v);
      }
      console.log("requests.productId", requests.productId);
      const bid = await Bid.findOne({ productId: requests.productId });
      console.log({ bid });
      // if (bid) {
      //   return response(res, 422, i18n.__("On this product bid is ongoing"));
      // }
      await Product.findByIdAndUpdate(requests.productId, {
        isDeleted: true,
      });
      const order = await Order.findOne({ productId: requests.productId });

      // Delete each order
      if (order) {
        await Order.findByIdAndDelete(order._id);
      }
      return success(res, i18n.__("DELETED_DATA"));
    } catch (error) {
      dump(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },
};
