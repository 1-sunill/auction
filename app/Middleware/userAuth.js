const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const CryptoJS = require("crypto-js");
const i18n = require("i18n");
const { decrypter } = require("../../helper/crypto");
const User = require("../../app/Models/User");
const { dump } = require("../../helper/logs");
let {
  success,
  failed,
  authFailed,
  failedValidation,
} = require("../../helper/response");

///////////////Authenticating admin /////////////////
module.exports = async (req, res, next) => {
  try {
    let token = "";
    let decoded = "";
    let userId = "";
    if (process.env.ENCRYPTION == "false") {
      token =
        (req.headers.authorization
          ? req.headers.authorization.split(" ")[1]
          : "") ||
        (req.body && req.body.token) ||
        req.body.token ||
        req.query.token ||
        req.query.token ||
        req.headers["x-access-token"];
      decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      let userExist = await User.findOne({ _id: decoded._id });
      if (!userExist || userExist.status === false)
        return authFailed(res, i18n.__("Account_Deactivated"), 402);
      userId = decoded._id;
      req.user = decoded;
      next();
    } else {
      var requestData = req.query.reqData || req.body.reqData;
      var string = requestData.replace(/ /g, "+");
      var bytes = CryptoJS.AES.decrypt(string, process.env.ENCRYPTION_SECRET);
      var decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
      if (!decryptedData && !decryptedData.token)
        return authFailed(res, "Session Expired.");
      decoded = jwt.verify(decryptedData.token, process.env.JWT_SECRET_KEY);
      let userExist = await User.findOne({ _id: decoded._id });
      console.log({ userExist });
      console.log("++++++++++++", decoded);
      if (userExist.currentDeviceRandomId !== decoded.uniqueString) {
        return authFailed(res, i18n.__("Unauthrized"), 403);
      } else if (!userExist || userExist.status === false) {
        return authFailed(res, i18n.__("Account_Deactivated"), 402);
      }
      (userId = decoded._id), (req.user = decoded), next();
    }
  } catch (error) {
    console.log(error);
    return authFailed(res, "Session Expired.");
  }
};
