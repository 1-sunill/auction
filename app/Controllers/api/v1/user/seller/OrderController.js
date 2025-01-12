const { Validator } = require("node-input-validator");
const FileUpload = require("../../../../../../services/upload-files");
const bcrypt = require("bcrypt");
const i18n = require("i18n");
const mongoose = require("mongoose");
const { ObjectId } = require("mongodb");
const Product = require("../../../../../Models/Product");
const Bid = require("../../../../../Models/Bid");
const Order = require("../../../../../../app/Models/Order");
const Comission = require("../../../../../../app/Models/Comission");
const User = require("../../../../../Models/User");
const Master = require("../../../../../Models/Master");
const moment = require("moment");
const fs = require("fs");
const pdf = require("html-pdf-node");
const ejs = require("ejs");

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
const {
  sendNewNotification,
  sendNotificationForSecondHighest,
} = require("../../../../../../helper/commonHelper");
const Admin = require("../../../../../Models/Admin");
let baseUrl = process.env.BASE_URL;

module.exports = {
  // Get All Order
  getMyOrders: async (req, res) => {
    try {
      const requests = await decrypter(req.query);
      if (!requests) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      let page = requests.page ? parseInt(requests.page) : 1;
      let pageSize = requests.limit ? parseInt(requests.limit) : 10;
      let skipIndex = (page - 1) * pageSize;
      let search = requests.search ? requests.search : "";
      let category = requests.category ? requests.category : "";
      let status = requests.status ? requests.status : "";

      // Get the user's ID

      let query = {
        sellerId: new ObjectId(req.user._id),
      };

      if (category && category != "") {
        query = Object.assign(query, {
          "product.categoryId": new ObjectId(category),
        });
      }
      if (status && status != "") {
        query = Object.assign(query, {
          sellerOrderStatus: status,
        });
      }
      console.log("ss", query);

      if (search && search != "") {
        console.log("search");
        const regex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/g;
        // Use the replace() function to remove the special characters
        if (search.match(regex)) {
          return success(res, i18n.__("FETCHDATA"), {
            orders: [],
            count: 0,
          });
        }
        let searchNew = search.replace(regex, "");
        // Find subcategory by name
        query.$or = [
          { "subCategory.enName": { $regex: searchNew, $options: "i" } },
          { "subCategory.arName": { $regex: searchNew, $options: "i" } },
        ];
      }

      const ordersWithProducts = await Order.aggregate([
        {
          $lookup: {
            from: "products",
            localField: "productId",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },

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
            localField: "product.categoryId",
            foreignField: "_id",
            as: "category",
          },
        },
        {
          $unwind: "$category",
        },
        { $match: query },
        // Project to shape the output
        {
          $project: {
            _id: 1, // Include order ID
            orderId: 1,
            sellerId: 1,
            productId: 1,
            orderStatus: 1,
            sellerOrderStatus: 1,
            shippingMethod: 1,
            selfPickUpTimer: 1,
            packTimer: 1,
            cancelAt: 1,
            packedAt: 1,
            returnAt: 1,
            deliveryAt: 1,
            createdAt: 1,
            updatedAt: 1,
            amount: 1,
            highestBidPrice: 1,
            productDetails: {
              _id: "$product._id",
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
                      { $arrayElemAt: ["$product.images.productImage", 0] },
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
              categoryId: {
                _id: "$category._id",
                enName: "$category.enName",
                arName: "$category.arName",
              },
            },
          },
        },
        {
          $sort: { createdAt: -1 },
        },
        { $skip: skipIndex }, // Skip documents
        { $limit: pageSize }, // Limit documents
      ]);

      // Respond with the fetched orders along with product details
      return response(res, 200, i18n.__("FETCHDATA"), {
        orders: ordersWithProducts,
      });
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },
  //Get Order Details
  getOrder: async (req, res) => {
    try {
      const requests = await decrypter(req.query);
      if (!requests) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      // Validate the decrypted request
      const v = new Validator(requests, {
        orderId: "required",
      });
      const matched = await v.check();
      if (!matched) {
        return failedValidation(res, v);
      }

      const order = await Order.findOne({ _id: requests.orderId });
      if (!order) {
        return response(res, 422, i18n.__("NOTFOUND"));
      }

      let query = {
        sellerId: new ObjectId(req.user._id),
        _id: new ObjectId(order._id),
      };
      let ordersWithProducts = await Order.aggregate([
        {
          $lookup: {
            from: "products",
            localField: "productId",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },
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
            localField: "userId",
            foreignField: "_id",
            as: "bidder",
          },
        },
        {
          $unwind: "$bidder",
        },

        { $match: query },
        {
          $lookup: {
            from: "bids", // Assuming the name of the bids collection is 'bids'
            localField: "productId",
            foreignField: "productId",
            as: "bids",
          },
        },

        {
          $project: {
            _id: 1,
            orderId: 1,
            sellerId: 1,
            productId: 1,
            boxNumber: 1,
            boxLength: 1,
            boxHeight: 1,
            boxWidth: 1,
            sellerOrderStatus: 1,
            shippingMethod: 1,
            selfPickUpTimer: 1,
            packTimer: 1,
            returnTimer: 1,
            orderStatus: 1,
            returnOrderStatus: 1,
            sellerReturnOrderStatus: 1,
            cancelReason: 1,
            returnReason: 1,
            cancelAt: 1,
            packedAt: 1,
            returnAt: 1,
            deliveryAt: 1,
            returnAcceptAt: 1,
            returnOrderPickedUp: 1,
            returnOrderPickedAt: 1,
            createdAt: 1,
            updatedAt: 1,
            amount: 1,
            vatAmount: 1,
            isAssign: 1,
            bidCount: { $size: "$bids" },
            productDetails: {
              _id: "$product._id",
              sellerId: "$product.sellerId",
              userName: "$bidder.userName",
              bidderId: "$bidder._id",
              name: "$bidder.name",
              quantity: "$product.quantity",
              unit: "$product.unit",
              productPrice: "$product.price",
              description: "$product.description",
              mobile: "$bidder.mobile",
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
              location: "$product.location",
              long: "$product.long",
              imageUrl: {
                $cond: {
                  if: { $isArray: "$product.images" },
                  then: {
                    $concat: [
                      process.env.AWS_URL,
                      { $arrayElemAt: ["$product.images.productImage", 0] },
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
      ]);

      const masterData = await Master.findOne({});
      ordersWithProducts = ordersWithProducts[0];
      ordersWithProducts.vatAmount = ordersWithProducts.vatAmount;
      ordersWithProducts.cancellationCharge = masterData?.cancellationCharge;
      ordersWithProducts.deliveryFee = masterData?.deliveryFee;
      ordersWithProducts.payableAmount =
        masterData?.vatAmount + ordersWithProducts?.amount;
      ordersWithProducts.refundAmount =
        masterData?.vatAmount +
        ordersWithProducts?.amount -
        masterData?.cancellationCharge;
      // Respond with the fetched orders along with product details
      return response(res, 200, i18n.__("FETCHDATA"), {
        orders: ordersWithProducts,
      });
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },
  orderPacked: async (req, res) => {
    try {
      const requests = await decrypter(req.body);
      if (!requests) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      // Validate the decrypted request
      const v = new Validator(requests, {
        orderId: "required",
        boxesNumber: "required|numeric",
        boxLength: "required|numeric",
        boxWidth: "required|numeric",
        boxHeight: "required|numeric",
      });

      const matched = await v.check();
      if (!matched) {
        return failedValidation(res, v);
      }

      const { orderId, boxesNumber, boxLength, boxWidth, boxHeight } = requests;

      // Retrieve the order based on orderId
      const order = await Order.findOne({ _id: orderId });

      // Check if the order exists
      if (!order) {
        return response(res, 422, i18n.__("Order_not_found"));
      }

      if (order.orderStatus === "Cancelled") {
        return response(res, 422, i18n.__("Order_Cancelled"));
      }

      let today = new Date();
      let orderConfirmedTime = new Date(order.createdAt);
      const selfPickUpTimer = moment(today).add(48, "hours").toISOString();
      const packTimer = moment(today).add(12, "hours").toISOString();

      let orderpackTime = moment(orderConfirmedTime)
        .add(2, "minutes")
        .toISOString();
      let at = new Date(orderpackTime);
      // if (!moment(at).isAfter(today)) {
      //   return response(res, 422, i18n.__("expired_packTime"));
      // }

      // Update the order status to 'Packed'
      order.orderStatus = "Packed";
      order.packedAt = new Date().toISOString();
      order.sellerOrderStatus = "Packed";
      order.boxNumber = boxesNumber;
      order.boxLength = boxLength;
      order.boxWidth = boxWidth;
      order.boxHeight = boxHeight;
      order.selfPickUpTimer = new Date(selfPickUpTimer);
      order.packTimer = new Date(packTimer);

      const userId = req.user._id;

      let title = "Green House";
      let message = "Your order packed successfully.";
      await sendNewNotification(order.userId, title, message);
      // Save the updated order document
      await order.save();

      // Respond with success message
      return response(res, 200, i18n.__("Order_packed_successfully"), {
        order,
      });
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },

  secondHighestBidder: async (req, res) => {
    try {
      const requests = await decrypter(req.body);
      if (!requests) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      // Validate the decrypted request
      const v = new Validator(requests, {
        productId: "required",
        bidderId: "required",
      });
      console.log("requests", requests);
      const matched = await v.check();
      if (!matched) {
        return failedValidation(res, v);
      }

      const existsProduct = await Product.findOne({ _id: requests.productId });

      if (!existsProduct) {
        return response(res, 422, i18n.__("NOTFOUND"));
      }
      const orderCount = await Order.countDocuments({
        productId: requests.productId,
      });
      const singleBidderCheck = await Order.countDocuments({
        productId: requests.productId,
        userId: { $ne: requests.bidderId },
      });
      if (singleBidderCheck === 1) {
        return response(res, 422, i18n.__("You can't reassign this order."));
      }
      console.log({ orderCount });
      if (orderCount === 2) {
        return response(res, 422, i18n.__("You can't reassign this order."));
      }
      const bidCheck = await Bid.findOne({
        productId: requests.productId,
        assignSecondHighestBidder: true,
      });
      console.log({ bidCheck });
      if (bidCheck) {
        return response(res, 422, i18n.__("You can't reassign this order."));
      }
      let params = {};
      params = Object.assign(params, {
        subCategoryId: existsProduct.subCategoryId,
        productId: requests.productId,
        bidType: "purchase",
      });

      // Check if the new bid amount is greater than the highest bid amount for the same product
      const highestBid = await Bid.findOne(params).sort({
        amount: -1,
      });
      const highestBids = await Bid.find(params).sort({
        amount: -1,
      });
      console.log("highestBid single", highestBid);
      console.log("highestBid array", highestBids);

      for (const bid of highestBids) {
        if (bid.amount === highestBid.secondHighestBidAmount) {
          const bidInfo = await Bid.findOne({ _id: new ObjectId(bid._id) });
          const title = "Green House";
          const message = " You won this auction.";
          await sendNotificationForSecondHighest(
            bidInfo.userId,
            title,
            message,
            bid._id
          );
          await Bid.updateMany(
            { _id: new ObjectId(bid._id) },
            {
              $set: {
                status: "unfilled",
                assignSecondHighestBidder: true,
                bidStatus: "won",
              },
            }
          );
        }
      }
      const order = await Order.findOne({ productId: requests.productId });
      await Order.updateOne({ _id: order._id }, { isAssign: 1 });
      // // Delete each order
      // if(order){
      //     await Order.findByIdAndDelete(order._id);
      // }

      // Respond with success message
      return response(res, 200, i18n.__("second_highest_bidder"));
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },

  auctionOrderPdf: async (req, res) => {
    try {
      const requests = await decrypter(req.body);
      console.log("}}}}}}}}}}}}}}}", requests);
      if (!requests) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      // Validate the decrypted request
      const v = new Validator(requests, {
        orderId: "required",
      });

      const matched = await v.check();
      if (!matched) {
        return failedValidation(res, v);
      }

      // Check appointment
      const order = await Order.aggregate([
        {
          $match: {
            _id: new ObjectId(requests.orderId),
          },
        },
        {
          $lookup: {
            localField: "subCategoryId",
            foreignField: "_id",
            from: "subcategories",
            as: "subcategories",
          },
        },
        { $unwind: "$subcategories" },
        {
          $lookup: {
            localField: "productId",
            foreignField: "_id",
            from: "products",
            as: "productDetails",
          },
        },
        { $unwind: "$productDetails" },
        {
          $lookup: {
            localField: "userId",
            foreignField: "_id",
            from: "users",
            as: "userDetails",
          },
        },
        { $unwind: "$userDetails" },
      ]);

      if (!order || order.length === 0) {
        return response(res, 422, i18n.__("Order_not_found"));
      }

      let htmlContent;
      const formattedDate = moment().format("YY-MM-DD HH:mm:ss");

      const adminVat = await Comission.find();
      // console.log(adminVat[0].vat)
      let dynamicData;

      let imageUrl = baseUrl + "/logo.png";

      let unitPrice = order[0].amount - order[0].vatAmount;
      let user = await User.findOne({ _id: order[0].userId });
      let taxRegistrationNumber;
      if (user.taxRegistrationNumber) {
        taxRegistrationNumber = 1;
      } else {
        taxRegistrationNumber = 2;
      }
      if (req.headers["accept-language"] == "en") {
        // console.log("}}}}}}}}}}}"); return 1;

        htmlContent = fs.readFileSync("views/orderInvoice.ejs", "utf-8");
        dynamicData = {
          orderNo: order[0].orderId,
          amount: order[0].amount,
          adminVatAmt: adminVat[0].vat,
          date: formattedDate,
          productName: order[0].subcategories.enName,
          quantity: order[0].productDetails.quantity,
          unitPrice: parseFloat(unitPrice),
          name: order[0].userDetails.name,
          unit: order[0].productDetails.unit,
          address: order[0].productDetails.productLocation,
          licenceNumber: order[0].userDetails.licenceNumber,
          qrCode: order[0].qrCode,
          invoiceNo: order[0].invoiceNo,
          productPrice: order[0].productDetails.price,
          vatAmount: parseFloat(order[0].vatAmount),
          baseUrl: imageUrl,
          taxRegistrationNumber: taxRegistrationNumber,
          taxNumber: user.taxRegistrationNumber,
        };
        console.log({ dynamicData });
      } else if (req.headers["accept-language"] == "ar") {
        htmlContent = fs.readFileSync("views/arorderInvoice.ejs", "utf-8");

        dynamicData = {
          orderNo: order[0].orderId,
          amount: order[0].amount,
          adminVatAmt: adminVat[0].vat,
          date: formattedDate,
          productName: order[0].subcategories.arName,
          quantity: order[0].productDetails.quantity,
          unitPrice: parseFloat(unitPrice),
          name: order[0].userDetails.name,
          unit: order[0].productDetails.unit,
          address: order[0].productDetails.productLocation,
          licenceNumber: order[0].userDetails.licenceNumber,
          qrCode: order[0].qrCode,
          invoiceNo: order[0].invoiceNo,
          productPrice: order[0].productDetails.price,
          vatAmount: parseFloat(order[0].vatAmount),
          baseUrl: imageUrl,
          taxRegistrationNumber: taxRegistrationNumber,
          taxNumber: user.taxRegistrationNumber,
        };
      }

      const compiledHtml = ejs.render(htmlContent, dynamicData);
      const options = { format: "A3" };

      try {
        const pdfBuffer = await pdf.generatePdf(
          { content: compiledHtml },
          options
        );
        const pdfFile = await FileUpload.uploadPdfToS3(pdfBuffer, "pdf");

        return response(res, 200, i18n.__("order_Invoice"), {
          url: pdfFile.url,
        });
      } catch (error) {
        console.error(error);
        return response(res, 422, i18n.__("failed_to_upload"));
      }
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },

  //Sold products history
  soldProducts: async (req, res) => {
    try {
      const requests = await decrypter(req.query);
      if (!requests) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      const page = requests.page ? parseInt(requests.page) : 1;
      const pageSize = requests.limit ? parseInt(requests.limit) : 10;
      const skipIndex = (page - 1) * pageSize;
      const search = requests.search ? requests.search : "";
      const category = requests.category ? requests.category : "";
      const status = requests.status ? requests.status : "";

      const query = {
        sellerId: new ObjectId(req.user._id),
        sellerOrderStatus: "Delivered",
      };

      if (category) {
        query["product.categoryId"] = new ObjectId(category);
      }

      if (search) {
        const regex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/g;
        if (search.match(regex)) {
          return success(res, i18n.__("FETCHDATA"), {
            orders: [],
            count: 0,
          });
        }
        const searchNew = search.replace(regex, "");
        query.$or = [
          { "subCategory.enName": { $regex: searchNew, $options: "i" } },
          { "subCategory.arName": { $regex: searchNew, $options: "i" } },
        ];
      }

      const ordersWithProducts = await Order.aggregate([
        {
          $lookup: {
            from: "products",
            localField: "productId",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },
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
            from: "categories",
            localField: "product.categoryId",
            foreignField: "_id",
            as: "category",
          },
        },
        { $unwind: "$category" },
        { $match: query },
        {
          $project: {
            _id: 1,
            orderId: 1,
            sellerId: 1,
            productId: 1,
            orderStatus: 1,
            sellerOrderStatus: 1,
            shippingMethod: 1,
            packTimer: 1,
            selfPickUpTimer: 1,
            cancelAt: 1,
            packedAt: 1,
            returnAt: 1,
            deliveryAt: 1,
            createdAt: 1,
            updatedAt: 1,
            amount: 1,
            highestBidPrice: 1,
            productDetails: {
              _id: "$product._id",
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
              location: "$product.location",
              long: "$product.long",
              imageUrl: {
                $map: {
                  input: "$product.images",
                  as: "image",
                  in: {
                    $concat: [process.env.AWS_URL, "$$image.productImage"],
                  },
                },
              },
              subCategory: {
                _id: "$subCategory._id",
                enName: "$subCategory.enName",
                arName: "$subCategory.arName",
              },
              categoryId: {
                _id: "$category._id",
                enName: "$category.enName",
                arName: "$category.arName",
              },
            },
          },
        },
        { $skip: skipIndex },
        { $limit: pageSize },
      ]);

      const ordersWithProductsCount = await Order.countDocuments(query);

      return response(res, 200, i18n.__("FETCHDATA"), {
        orders: ordersWithProducts,
        count: ordersWithProductsCount,
      });
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },
};
