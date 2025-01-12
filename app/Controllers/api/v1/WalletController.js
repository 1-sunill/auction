const {
  serverError,
  failedValidation,
  success,
  failed,
  response,
} = require("../../../../helper/response");
const {
  walletTransaction,
  performWalletTransaction,
  performWalletTransactionDebit,
  sendNewNotification,
} = require("../../../../helper/commonHelper");
const { Validator } = require("node-input-validator");
const Wallet = require("../../../Models/Wallet");
const User = require("../../../Models/User");
const { ObjectId } = require("mongodb");
const { decrypter } = require("../../../../helper/crypto");
const i18n = require("i18n");
const axios = require("axios");
let baseUrl = process.env.BASE_URL;
module.exports = {
  addWalletAmount: async (req, res) => {
    try {
      const requests = await decrypter(req.body);
      if (requests === false) {
        return response(res, 500, i18n.__("Internal_Error"));
      }
      const validate = new Validator(requests, {
        amount: "required",
      });
      const matched = await validate.check(); // Need to await the validation check
      if (!matched) {
        return failedValidation(res, validate);
      }
      const userId = req.user._id;
      console.log(userId);
      //   let userId = "65f979c7e81be33e6a29a827";
      await performWalletTransaction(
        userId,
        "",
        requests.amount,
        1,
        "Wallet-Add Money"
      );
      let title = "Green House";
      let message = "Amount added in your wallet successfully.";
      await sendNewNotification(userId, title, message);
      return success(res, "Amount inserted successfully");
    } catch (error) {
      console.log({ error });
      return serverError(res, "Internal server error.");
    }
  },
  //withdraw Amount From Wallet to bank
  withdrawAmountFromWallet: async (req, res) => {
    try {
      var requests = await decrypter(req.body);
      if (requests === false) {
        return response(res, 500, i18n.__("Internal_Error"));
      }
      const validate = new Validator(requests, {
        amount: "required",
      });
      const matched = await validate.check(); // Need to await the validation check
      if (!matched) {
        return failedValidation(res, validate);
      }
      const userId = req.user._id;
      const userCheck = await User.findOne({ _id: userId });
      console.log(
        "userCheck.availableWalletAmount",
        userCheck.availableWalletAmount
      );
      if (
        parseFloat(requests.amount) >
        parseFloat(userCheck.availableWalletAmount)
      ) {
        return response(
          res,
          422,
          i18n.__(
            "Withdraw amount should be equal or less to available amount."
          )
        );
      }

      //   let userId = "65f979c7e81be33e6a29a827";
      await walletTransaction(userId, "", requests.amount, 2, "Withdraw-Money");
      let title = "Green House";
      let message = "Amount withdraw in your wallet successfully.";
      await sendNewNotification(userId, title, message);
      return success(res, "Amount withdraw successfully");
    } catch (error) {
      console.log({ error });
      return serverError(res, "Internal server error.");
    }
  },
  walletHistory: async (req, res) => {
    try {
      const requests = await decrypter(req.query);
      const userId = req.user._id;

      console.log({ userId });

      const page = requests.page ? parseInt(requests.page, 10) : 1;
      const pageSize = requests.limit ? parseInt(requests.limit, 10) : 10;
      const skipIndex = (page - 1) * pageSize;

      let query = {
        userId: userId,
        // amount: { $gt: 0 },
      };

      if (requests.transactionType) {
        query = {
          ...query,
          transactionType: {
            $regex: new RegExp(requests.transactionType, "i"),
          },
        };
      }

      if (requests.search) {
        if (requests.search === "wallet") {
          query = {
            ...query,
            // categoryName: "",
          };
        } else {
          query = {
            ...query,
            categoryName: {
              $regex: new RegExp(requests.search, "i"),
            },
          };
        }
      }

      console.log({ query }); // Moved the console.log statement here for clarity

      const wallet = await Wallet.find(query)
        .sort({ createdAt: -1 })
        .skip(skipIndex)
        .limit(pageSize);

      const user = await User.findById(userId);
      const walletCount = await Wallet.countDocuments({ userId: userId });

      const newData = {
        walletHistory: wallet,
        totalCount: walletCount,
        walletTotalAmount: user.walletTotalAmount,
        availableWalletAmount: user.availableWalletAmount,
        freezedWalletAmount: user.freezedWalletAmount,
      };

      return success(res, "Wallet data fetched successfully", newData);
    } catch (error) {
      console.log({ error });
      return serverError(res, "Internal server error.");
    }
  },
  //create new payment
  createNewPayment: async (req, res) => {
    try {
      const requests = await decrypter(req.body);
      if (requests === false) {
        return response(res, 500, i18n.__("Internal_Error"));
      }
      const validate = new Validator(requests, {
        amount: "required",
      });
      const matched = await validate.check(); // Need to await the validation check
      if (!matched) {
        return failedValidation(res, validate);
      }
      const data = {
        profile_id: 44392,
        tran_type: "sale",
        tran_class: "ecom",
        cart_id: "4244b9fd-c7e9-4f16-8d3c-4fe7bf6c48ca",
        cart_description: "Dummy Order 35925502061445345",
        cart_currency: "SAR",
        cart_amount: parseFloat(requests.amount),
        callback: "https://yourdomain.com/yourcallback",
        return: baseUrl + "/payment/status",
        // return: "https://yourdomain.com/yourcallback",
      };

      // Configuration for the axios request
      const config = {
        method: "post",
        url: "https://secure.clickpay.com.sa/payment/request",
        headers: {
          authorization: "SHJNLWJZTZ-JHNDGJGD6J-BTNT9NMWGL",
          "content-type": "application/json",
        },
        data: data,
      };
      // const response = await axios(config);
      // console.log(JSON.stringify(response.data, null, 2));

      // Extract tran_ref from the response
      // const tranRef = response.data.tran_ref;

      // Append tran_ref to the return URL
      // data.return = `${baseUrl}/api/v1/user/validate-payment?tran_ref=${tranRef}`;
      // let url = _setEndPoint("SAU") + "payment/request";
      let callbackFunction = "https://www.google.com/";
      // _sendPost(url, data, callbackFunction);
      axios(config)
        .then((response) => {
          console.log(JSON.stringify(response.data, null, 2));

          success(res, "Patment Success", response.data);
        })
        .catch((error) => {
          console.error(error);
        });
    } catch (error) {
      console.error(error);
      res.status(500).send("An error occurred");
    }
  },
  status: async (req, res) => {
    console.log("REQ", await req);
    console.log("RES", await res);
    console.log("BOTH", await req.res);

    return success(res, "Data fetched success");
    // return req.query;
  },
  validatePayment: async (tranRef, callback, res) => {
    data = {
      profile_id: 44392,
      tran_ref: tranRef,
    };
    url = _setEndPoint("SAU") + "payment/query";
    const data = _sendPost(url, data, callback);
    return success(res, "Data fetched success", data);
  },
  failed: async (req, res) => {
    console.log("ssssssssss");
    return res.status(400).send({ success: false, message: "Payment Failed" });
  },
  success: async (req, res) => {
    console.log("ffffffffff");
    return res.status(200).send({ success: true, message: "Payment Success" });
  },
};
function _sendPost(url, objData, callback) {
  var sendData = {
    method: "post",
    url: url,
    headers: {
      authorization: "SHJNLWJZTZ-JHNDGJGD6J-BTNT9NMWGL",
    },
    data: objData,
  };
  axios(sendData)
    .then((res) => {
      console.log("_sendPost", res.data);
      return res.data;
      // return success(res, "Success payment", res.data);
      // callback(res.data);
    })
    .catch((error) => {
      //This error will happen catch exceptions
      return error;
      // callback({ "response_code:": 400, result: error.errno });
      // return serverError(res, "Some error.");
    });
}
function _setEndPoint(region) {
  const regions_urls = { SAU: "https://secure.clickpay.com.sa" };

  for (const [key, value] of Object.entries(regions_urls)) {
    if (key === region) {
      console.log("_setEndPoint", value);

      return value;
    }
  }
}
