const { Validator } = require("node-input-validator");
const FileUpload = require("../../../../../../services/upload-files");
const QRCode = require("../../../../../../services/upload-files");
const bcrypt = require("bcrypt");
const i18n = require("i18n");
const mongoose = require("mongoose");
const { ObjectId } = require("mongodb");
const Product = require("../../../../../Models/Product");
const Order = require("../../../../../../app/Models/Order");
const Master = require("../../../../../../app/Models/Master");
const moment = require("moment");
const User = require("../../../../../Models/User");
const Bid = require("../../../../../Models/Bid");
const Notification = require("../../../../../Models/Notification");
const Commision = require("../../../../../Models/Comission");
const {
  performWalletTransaction,
  sendNewNotification,
  walletTransaction,
  performSellerWalletTransaction,
  makeApiCall,
} = require("../../../../../../helper/commonHelper");
require("dotenv").config();
const QRCodeGen = require("qrcode");
const base64js = require("base64-js");

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
function generateTransactionId() {
  const randomNumber = Math.floor(Math.random() * 9000000000) + 1000000000; // Generate a random 9-digit number
  return randomNumber.toString(); // Convert the number to a string
}

async function parseZatcaQrCode(qrData) {
  console.log({ qrData });
  try {
    const today = new Date();
    const currentDate = moment(today).format("YYYY-MM-DD");
    // console.log({ currentDate });
    const tokenResponse = await makeApiCall(
      "https://api.complyance.io/test/auth-api/v1/proto/signIn",
      "post",
      {
        "Content-Type": "application/json",
      },
      JSON.stringify({
        refreshToken:
          "eyJjdHkiOiJKV1QiLCJlbmMiOiJBMjU2R0NNIiwiYWxnIjoiUlNBLU9BRVAifQ.lJmYRAUgfWW20HuYeyATFNd83afBBSr1atC0D-dHdKi-n9p6oB8MLpHagEnPMc0YW86Jq8Qi6H_u8tVe99k86i1O44EedlzRC5YoywFZzRrn-EHkOypZSzBsXxtSUzEO4BIVUQUQ4Nh_Q6zGMi3ZRlLKqJK1S1t_iCdJEjWK2gBcM60Q_WhLbG3dlOC2_JvnYyf9w0HXI7NnwDBufTrwDEeKSTtZW8RsPtWDKN_R1gxtUEbOCWqFX7CcCvH4t4Pl6ssyeTExpb90rCHY3IsCJ7tY5KRaaT3EDVORojBpFDmvGRV2zm7CrB1lSwhRU6veYrJh6L7RDkp_LR8k-4z81g.E9DmzhQ92x6oIO6O.9rExEq0qOdyQDFZ7BkyiTGikKdR5ocU9oI1_Dwfa0Bnm_O1mC8TF_Gzh7i51u1jMQsYTZjeMqIfW_-V7QBPAMuZGl3k3R0_WaZdQLGbRgxNqUof8yZN0e6yov_f67w_b2Gse0YpBhDRZLG0Ww3N2i0iK7eqtpmaRjVxTzIepvSOAciNrpWlHvhBnn9kwvQabb6XP7vh9PdqfErQAIfsmZY6ltZPIrSbGBKObSVh5LkPwoKUiw1S4Q692-rUMrse7YZc-T3EhKYNkANgz-OXyM_ivYekUrE6_8SwHRGHBmiykD3hOx0fiWxvIqtBha4-ycGVfQkmXmIYgn0sk-8rXsXJCJ8Usvg-wAFOM95OTLCbobSylbVhkLi5700RF00q5K-YbqFj9K7FB_8nbRoZidQM-kTxgI9-XAfYpNg4T8SA0x5Wz5KY-FnnbHYofRrtRujUuAyBe-3qRdDBWrFwXhhovmvBVxJA71XuIkW7kND_T3nBMd-vM5eq8Hi5Lqvnff6HztwJuCtH4R_yfu7NSgpcYTx3nsX56GwdhjEdUkxfNvpbMY4wsuNxVAy75lwIB_De6pAxQixwZ_QNqcNLCvo1c3mTSKGBOnXbElzQaNzsy9A-mR7weAg4HC095A4ojSyRXiJw20fmOIHeLT7PRTbCPOht3hyDVvjK7CoWvKZ82JaRW30j_0AAQ2cASiVyXMGclFGcvrVOxPuYoDb7hb129AQ7ZpqXGbklfpcO9C-HeqZB_2duITmSweRmtPIXiu3R2PCBJPsmBM1ilZwCxEFqPTY5unRj3PafNgPtZpIY5jX2FIiOqgAT0S-NbRqCLuAspwUrZpWjbz7WO_KuIZinwdmvUIiDyJdpAyyxtljwY_7-Ngof7lfFF-SZOd38W4yFO6Gfr52SyrQaWBmW-rJUQ6oX7ak1X0gaqmjrmqMYAwjpgtr_bcxqZ3twROiv9svStV2lS_qZoi2Is8qV7LS-cpS63ZhTlPSn3A_iLZiljqURjAyBRdww6O2tUerb_IRgvABR4J7Hb1NMIBdUuAduqzKjLIc8KOg0nhSsO5DIIv9pbNAedHsXNbIzk8Mt5B3q-M_MXrwjhWbDau3MW1NPWqIdUkbiCSy66d_-boGCaJ2a1LuIRsSL2pvbrKHClaA8CvEjU-9B7292-AFhsinCqlICxjtN55cAdoscE7-dLnqD_Vm494FGlxD0x-EEkYvymtv0Wh4vlCQ3mxiJrv_P9--5uGx6FFVj4I3fk56YTDUHB7R-ALNDZtlZSIpoU6qhUkqZK_DrQc1QUM2o3wOBdlQxgdX03iQNR-7n6llrOTZFaKMKkUrGFUslzig.dPFy7bVbnD1_iloLcgGtQA",
      })
    );

    const accessToken = tokenResponse.accessToken;

    const qrCodeResponse = await makeApiCall(
      "https://api.complyance.io/test/api/v1/proto/generateQRCode",
      "post",
      {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      JSON.stringify({
        invoiceData: {
          documentType: "SIMPLIFIED_TAX_INVOICE",
          referenceId: "14",
          documentIssueDateTime: today,
          sellerName: qrData.Sellername,
          sellerAddress: {
            addrLine1: qrData.Address,
            addrLine2: "Amjad Building",
            additionalNo: "1234",
            buildingNumber: "1234",
            city: "Dammam",
            state: "Riyadh",
            zipCode: "12313",
            district: "Riyadh",
            country: "SA",
          },
          buyerName: qrData.BuyerName,
          documentLineItems: [
            {
              lineItemDesc: qrData.Description,
              lineItemPrice: qrData.lineItemPrice,
              lineItemQty: qrData.lineItemQty,
              lineItemTaxableAmount: qrData.lineItemTaxableAmount,
              discountOnLineItem: 0.0,
              vatRateOnLineItem: qrData.vatRateOnLineItem,
              lineItemVatAmount: qrData.lineItemVatAmount,
              lineItemSubTotal: qrData.lineItemSubTotal,
            },
          ],
          totalExcludingVat: qrData.totalExcludingVat,
          totalTaxableAmountExcludingVat: qrData.totalTaxableAmountExcludingVat,
          vatTotal: qrData.vatTotal,
          documentTotal: qrData.documentTotal,
          discountOnDocumentTotal: qrData.discountOnDocumentTotal,
          isSpecialBillingAgreement: "false",
          isTransactionType: "false",
          isSelfBilled: "false",
          isThirdParty: "false",
          isNominalSupply: "false",
          isExport: "false",
          isSummary: "false",
          supplyDate: "2022-12-30T09:58:24.000Z",
          sellerVatRegistrationNumber: "300055184400003",
          sellerGroupVatRegistrationNumber: "",
          additionalSellerIdType: "CRN",
          additionalSellerIdNumber: "",
          specialTaxTreatment: "0",
          currency: "SAR",
          paymentMeans: "OTHER",
          documentId: 146,
        },
      })
    );

    return qrCodeResponse;
  } catch (error) {
    console.error("Error:", error.message);
    return { error: error.message }; // Properly return the error message
  }
}

//decode
async function decodeEncrptedData(decodeData) {
  const encodedString = decodeData.encodedQrCodeData;
  console.log({ encodedString });
  const decodedBytes = base64js.toByteArray(encodedString);
  let index = 0;
  const parsedData = {};

  while (index < decodedBytes.length) {
    const tag = decodedBytes[index];
    const length = decodedBytes[index + 1];
    const value = new TextDecoder().decode(
      decodedBytes.slice(index + 2, index + 2 + length)
    );

    switch (tag) {
      case 1:
        parsedData["Seller Name"] = value;
        break;
      case 2:
        parsedData["VAT Registration Number"] = value;
        break;
      case 3:
        parsedData["Invoice Date"] = value;
        break;
      case 4:
        parsedData["Total Amount"] = value;
        break;
      case 5:
        parsedData["VAT Amount"] = value;
        break;
      case 6:
        parsedData["Signature"] = value;
        break;
      case 7:
        parsedData["Public Key"] = value;
        break;
      default:
        break;
    }

    index += 2 + length;
  }

  return parsedData;
}
module.exports = {
  //Placed a order
  addOrder: async (req, res) => {
    try {
      // Decrypt the request body
      const requests = await decrypter(req.body);
      const transactionId = generateTransactionId();

      if (!requests) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      // Validate the request parameters
      const v = new Validator(requests, {
        sellerId: "required",
        productId: "required",
        amount: "required",
        shippingMethod: "required",
        highestBidPrice: "required",
        subCategoryName: "required",
        categoryName: "required",
      });

      const matched = await v.check();
      if (!matched) {
        return failedValidation(res, v);
      }
      // Extract necessary data from the request
      const {
        sellerId,
        productId,
        amount,
        shippingMethod,
        highestBidPrice,
        categoryId,
        vatAmount,
      } = requests;
      const user = await User.findOne({ _id: req.user._id });
      if (user.availableWalletAmount < parseFloat(amount)) {
        return response(
          res,
          422,
          `Your available amount (${user.availableWalletAmount}) is insufficient for this order.`
        );
        return false;
      }
      const existsProduct = await Product.findOne({ _id: requests.productId });

      if (!existsProduct) {
        return response(res, 422, i18n.__("NOTFOUND"));
      }

      // Generate order ID with year and random suffix
      const year = new Date().getFullYear().toString().slice(-2); // Get last two digits of the current year
      const randomSuffix = Math.floor(10000 + Math.random() * 9000); // Random 6-digit number
      const orderId = year + randomSuffix;
      const invoiceNo = "INC" + year + randomSuffix;

      const userId = req.user._id;

      let existingOrder = await Order.findOne({ userId, sellerId, productId });
      if (existingOrder) {
        return response(res, 422, i18n.__("Order_already_placed"));
      }
      let today = new Date();
      const selfPickUpTimer = moment(today).add(48, "hours").toISOString();
      const packTimer = moment(today).add(12, "hours").toISOString();
      const vatPercent = await Commision.find();
      const seller = await User.findOne({ _id: sellerId });
      const buyer = await User.findOne({ _id: req.user._id });
      const product = await Product.findOne({ _id: productId });
      let intAmount = parseFloat(highestBidPrice);
      const discountOnDocumentTotal = 0;
      const lineItemTaxablePrice = (intAmount - discountOnDocumentTotal) * 1;

      const lineItemVatPrice = lineItemTaxablePrice * (vatPercent[0].vat / 100);
      const lineItemSubTotalPrice = lineItemTaxablePrice + lineItemVatPrice;
      const vatTotalPrice =
        (lineItemTaxablePrice - discountOnDocumentTotal) *
        (vatPercent[0].vat / 100);
      const documentTotalPrice = lineItemTaxablePrice + vatTotalPrice;
      const totalExcludingVatAmt =
        lineItemTaxablePrice - discountOnDocumentTotal;
      const documentTotalAmt = totalExcludingVatAmt + vatTotalPrice;
      const qrData = {
        Sellername: seller.name,
        BuyerName: buyer.name,
        TradeLicensenumber: seller.licenceNumber,
        Address: product.productLocation,
        Description: product.description,
        lineItemPrice: intAmount,
        lineItemQty: 1,
        lineItemTaxableAmount: lineItemTaxablePrice,
        vatRateOnLineItem: vatPercent[0].vat,
        lineItemVatAmount: parseFloat(lineItemVatPrice.toFixed(2)),
        lineItemSubTotal: lineItemSubTotalPrice,
        totalExcludingVat: totalExcludingVatAmt,
        totalTaxableAmountExcludingVat: lineItemTaxablePrice,
        vatTotal: parseFloat(vatTotalPrice.toFixed(2)),
        documentTotal: documentTotalAmt,
        discountOnDocumentTotal: discountOnDocumentTotal,
      };
      // Create a new order document
      let newOrder = new Order({
        orderId: orderId,
        userId: req.user._id, // Assuming user ID is stored in req.user._id
        sellerId,
        productId,
        orderStatus: "Confirmed",
        sellerOrderStatus: "Received",
        orderPlaced: true,
        shippingMethod: shippingMethod ? shippingMethod : "myself",
        subCategoryId: existsProduct.subCategoryId,
        categoryId: categoryId,
        amount: amount, // Assuming price is the amount to be paid for the order
        highestBidPrice: highestBidPrice,
        selfPickUpTimer: selfPickUpTimer,
        packTimer: packTimer,
        vatAmount: parseFloat(vatTotalPrice.toFixed(2)),
        qrCode: "",
        invoiceNo,
      });

      console.log({ qrData });
      const parsedData = await parseZatcaQrCode(qrData);
      // Parse the decoded bytes
      const parsedDatanew = await decodeEncrptedData(parsedData); // Ensure parseZatcaQrCode is async if necessary
      console.log(parsedDatanew);

      // Create QR code data
      let qrcode_name = Date.now();
      let qr_code = await QRCode.generateQr(
        JSON.stringify(parsedDatanew),
        qrcode_name
      );
      newOrder.qrCode = process.env.AWS_URL + qr_code;
      // console.log({ newOrder });
      const checkSecondHighest = await Bid.find({ productId: productId }).sort({
        amount: -1,
      });
      if (requests.bidId) {
        await Bid.updateOne({ _id: requests.bidId }, { status: "filled" });
      }
      console.log("checkSecondHighest", checkSecondHighest[0]);
      let totalFreezAmt = 0;
      let newFreezedWalletAmount = 0;

      if (checkSecondHighest[0].bidStatus == "missed") {
        //This is for second highest user when first one is loss the bid amount not freez and deduct direct walletamount
        console.log("################missed", requests);
        await walletTransaction(
          req.user._id,
          sellerId,
          amount,
          2,
          requests.subCategoryName,
          transactionId,
          requests.categoryName
        );
      } else {
        console.log("################won", requests);

        totalFreezAmt = user.freezedWalletAmount - highestBidPrice;
        newFreezedWalletAmount = totalFreezAmt < 0 ? 0 : totalFreezAmt;

        await User.updateOne(
          { _id: req.user._id },
          { $set: { freezedWalletAmount: newFreezedWalletAmount } }
        );
        const remainingAmt = amount - highestBidPrice;
        await performWalletTransaction(
          req.user._id,
          sellerId,
          amount,
          2,
          requests.subCategoryName,
          transactionId,
          requests.categoryName,
          remainingAmt
        );

        await performSellerWalletTransaction(
          req.user._id,
          sellerId,
          amount,
          1,
          requests.subCategoryName,
          transactionId,
          requests.categoryName
        );
      }

      const title = "Green House";
      const message = "Order placed successfully.";
      if (requests.notificationId) {
        await Notification.updateOne(
          { _id: requests.notificationId },
          { secondHighestmsg: 2 }
        );
      }
      await sendNewNotification(req.user._id, title, message);

      // Save the new order
      const saveOrder = await newOrder.save();

      // Respond with success message
      return response(res, 200, i18n.__("Order_placed_successfuly"), {
        order: saveOrder,
      });
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },
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
      // let orderId = requests.orderId ? requests.orderId : "";

      // Get the user's ID

      let query = {
        userId: new ObjectId(req.user._id),
      };

      if (category && category != "") {
        query = Object.assign(query, {
          "product.categoryId": new ObjectId(category),
        });
      }
      if (status && status != "") {
        query = Object.assign(query, {
          orderStatus: status,
        });
      }
      // if (orderId && orderId != "") {
      //   query = Object.assign(query, {
      //     orderId: orderId,
      //   });
      // }
      // console.log("ss", query);

      if (search && search != "") {
        console.log("++++++++++++++", search);

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
          { orderId: search },
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
            cancelAt: 1,
            packedAt: 1,
            deliveryAt: 1,
            returnAt: 1,
            selfPickUpTimer: 1,
            packTimer: 1,
            createdAt: 1,
            updatedAt: 1,
            amount: 1,
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
        userId: new ObjectId(req.user._id),
        _id: new ObjectId(order._id),
      };
      let ordersWithProducts = await Order.aggregate([
        { $match: query },

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
            localField: "product.sellerId",
            foreignField: "_id",
            as: "seller",
          },
        },
        {
          $unwind: "$seller",
        },

        {
          $lookup: {
            from: "bids", // Assuming the name of the bids collection is 'bids'
            localField: "productId",
            foreignField: "productId",
            as: "bids",
          },
        },
        {
          $lookup: {
            from: "reviewratings",
            let: {
              sellerId: "$sellerId",
              userId: "$userId",
              orderId: new ObjectId(order._id),
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$sellerId", "$$sellerId"] },
                      { $eq: ["$userId", "$$userId"] },
                      { $eq: ["$orderId", "$$orderId"] },
                    ],
                  },
                },
              },
            ],
            as: "sellerRating",
          },
        },

        {
          $project: {
            _id: 1,
            orderId: 1,
            userId: 1,
            sellerId: 1,
            productId: 1,
            orderStatus: 1,
            boxNumber: 1,
            boxLength: 1,
            boxHeight: 1,
            boxWidth: 1,
            sellerOrderStatus: 1,
            shippingMethod: 1,
            returnOrderStatus: 1,
            sellerReturnOrderStatus: 1,
            cancelReason: 1,
            returnReason: 1,
            selfPickUpTimer: 1,
            packTimer: 1,
            returnTimer: 1,
            cancelAt: 1,
            packedAt: 1,
            deliveryAt: 1,
            returnAt: 1,
            returnAcceptAt: 1,
            returnOrderPickedAt: 1,
            returnOrderPickedUp: 1,
            createdAt: 1,
            updatedAt: 1,
            amount: 1,
            vatAmount: 1,
            bidCount: { $size: "$bids" },
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
            rating: { $ifNull: ["$sellerRating.rating", null] },
          },
        },
      ]);

      const masterData = await Master.findOne({});
      ordersWithProducts = ordersWithProducts[0];
      ordersWithProducts.vatAmount = ordersWithProducts.vatAmount;
      ordersWithProducts.cancellationCharge = masterData?.cancellationCharge;
      ordersWithProducts.deliveryFee = masterData?.deliveryFee;
      ordersWithProducts.payableAmount = ordersWithProducts?.amount;
      ordersWithProducts.refundAmount =
        ordersWithProducts?.amount - masterData?.cancellationCharge;

      // Respond with the fetched orders along with product details
      return response(res, 200, i18n.__("FETCHDATA"), {
        orders: ordersWithProducts,
      });
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },

  cancelOrder: async (req, res) => {
    try {
      // Decrypt the request body
      const requests = await decrypter(req.body);

      if (!requests) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      // Validate the request parameters
      const v = new Validator(requests, {
        type: "required|in:cancel,receive,return,returnOrderPicked",
        orderId: "required",
        cancelReason: "requiredIf:type,cancel",
        returnReason: "requiredIf:type,return",
      });

      const matched = await v.check();
      if (!matched) {
        return failedValidation(res, v);
      }

      const orderId = requests.orderId;
      const order = await Order.findOne({ _id: orderId });
      let bid = await Bid.find({ productId: order.productId }).sort({
        amount: -1,
      });
      console.log("bid details", bid[0]);
      // return 1;
      // Check if the order exists
      if (!order) {
        return response(res, 422, i18n.__("Order_not_found"));
      }
      if (requests.type === "cancel") {
        if (order.orderStatus === "Packed") {
          return response(res, 422, i18n.__("Order_Packed"));
        }
      }

      if (requests.type === "return") {
        let currentTime = new Date();
        let returnTime = new Date(order.returnTimer); // Assuming order.returnTimer is a valid date string

        if (!moment(returnTime).isAfter(currentTime)) {
          return response(res, 422, i18n.__("expired_returnTime"));
        }
      }

      let updateData = { orderStatus: "" };
      let title = "Auction";
      let message;
      switch (requests.type) {
        case "cancel":
          updateData.orderStatus = "Cancelled";
          updateData.cancelAt = new Date().toISOString();
          updateData.sellerOrderStatus = "Cancelled";
          updateData.cancelReason = requests.cancelReason || null;
          message = `Order cancelled`;
          //First one should loss

          if (bid) {
            await Bid.updateOne({ _id: bid[0]._id }, { bidStatus: "loss" });
            if (bid.length >= 2) {
              await Bid.updateOne({ _id: bid[1]._id }, { bidStatus: "loss" });
            }

            // if (bid.length > 1) {
            //   await Bid.updateOne(
            //     { _id: bid[1]._id },
            //     { bidStatus: "won", status: "unfilled" }
            //   );
            // }
          }

          await sendNewNotification(req.user._id, title, message);
          break;
        case "return":
          updateData.orderStatus = "Returned";
          updateData.returnAt = new Date().toISOString();
          updateData.sellerOrderStatus = "Returned";
          updateData.returnReason = requests.returnReason || null;
          message = `Order returned`;
          await sendNewNotification(req.user._id, title, message);
          break;
        case "returnOrderPicked":
          updateData.returnOrderPickedAt = new Date().toISOString();
          break;
        default:
          updateData.orderStatus = "Delivered";
          let today = new Date();
          const selfPickUpTimer = moment(today).add(12, "hours").toISOString();
          updateData.returnTimer = new Date(selfPickUpTimer);
          updateData.deliveryAt = new Date().toISOString();
          updateData.sellerOrderStatus = "Delivered";
          break;
      }
      if (requests.type === "cancel") {
        console.log("Cancel request", requests);
        const orderDetail = await Order.findOne({ _id: orderId });
        console.log("Cancel order request", orderDetail);
        await performWalletTransaction(
          req.user._id,
          "",
          orderDetail.amount,
          1,
          `Refund Amount - ${requests.subCategoryName}`,
          ""
        );

        //deduct from seller wallet
        await performSellerWalletTransaction(
          req.user._id,
          orderDetail.sellerId,
          orderDetail.amount,
          2,
          `Return Amount - ${requests.subCategoryName}`,
          ""
        );
      }
      const updatedOrder = await Order.findOneAndUpdate(
        { _id: orderId },
        { $set: updateData },
        { new: true }
      );

      // Check if the order exists and was successfully updated
      if (!updatedOrder) {
        return response(res, 422, i18n.__("Order_not_found"));
      }

      let successMessage = "";
      switch (requests.type) {
        case "cancel":
          successMessage = i18n.__("Order_canceled_successfully");
          break;
        case "return":
          successMessage = i18n.__("Order_return_successfully");
          break;
        case "returnOrderPicked":
          successMessage = i18n.__("Order_picked_successfully");
          break;
        default:
          successMessage = i18n.__("Order_received_successfully");
          break;
      }

      // Respond with success message
      return response(res, 200, successMessage, { order: updatedOrder });
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },

  rejectOrder: async (req, res) => {
    try {
      // Decrypt the request body
      const requests = await decrypter(req.body);

      if (!requests) {
        return response(res, 500, i18n.__("Internal_Error"));
      }

      // Validate the request parameters
      const v = new Validator(requests, {
        bidId: "required",
        productId: "required",
      });

      const matched = await v.check();
      if (!matched) {
        return failedValidation(res, v);
      }

      const { bidId } = requests;
      const bidCheck = await Bid.findOne({ _id: bidId });

      if (!bidCheck) {
        return response(res, 422, i18n.__("Bid not found"));
      }

      await Bid.updateOne(
        { _id: bidId },
        { bidStatus: "missed", status: "filled" }
      );
      await Order.updateOne(
        { productId: requests.productId },
        { isAssign: 2, secondHighestUser: bidCheck.userId }
      ); //Reject order bidder
      console.log("@@@@@@@@@@@@@@@@@", requests);
      if (requests.notificationId) {
        await Notification.updateOne(
          { _id: requests.notificationId },
          { secondHighestmsg: 2 }
        );
      }
      return response(res, 200, i18n.__("Your bid rejected successfully."));
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__("Internal_Error"));
    }
  },
};
