const mongoose = require('mongoose');
const UserModel = require('../Models/Admin');
const response = require('../../helper/helper');
const config = process.env;
const jwt = require('jsonwebtoken');
const {
    unauthorized,
    failed
  } = require('../../helper/helper')

const ObjectId = mongoose.Types.ObjectId;


/*********************** Check user auth token  **************************/
module.exports = function (req, res, next) {

    try{
        const token = (req.headers.authorization ? req.headers.authorization.split(" ")[1] : "") || (req.body && req.body.access_token) || req.body.token || req.query.token || req.headers["x-access-token"];
        if(!token){
            return failed(res, "Access denied, no token found");
        }
        let decoded = jwt.verify(token, process.env.JWT_SECRET_KEY); //jwt verify the token and returns payload
        // console.log(decoded);
      var userId = decoded._id;
      let _id = new ObjectId(userId);
        
      req.user = decoded; //doubt
      next();
    }catch(error){
        console.log('sd',error);
        return unauthorized(res,'Session Expired',{});
    }
};
