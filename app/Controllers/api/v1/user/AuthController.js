const {
  Validator
} = require('node-input-validator')
const FileUpload = require('../../../../../services/upload-files')
const User = require('../../../../Models/User')
const MobileOtpVerification = require('../../../../Models/MobileOtpVerification');
const bcrypt = require('bcrypt')
const i18n = require("i18n")
const mongoose = require('mongoose')
const {
  ObjectId
} = require('mongodb');
const Category = require('../../../../../app/Models/Category')

const {
  success,
  response,
  failedValidation,
  failed,
  authFailed,
  serverError
} = require('../../../../../helper/response')
const {
  decrypter
} = require('../../../../../helper/crypto');
const {
  dump
} = require('../../../../../helper/logs');

module.exports = {

  // register API
  register: async (req, res) => {
    try {
      // console.log('+++++++++++++++qqqqqqqqqq', req.body);
      var requests = await decrypter(req.body);
      if (requests == false) {
        return response(res, 500, i18n.__('Internal_Error'));
      }

      const v = new Validator(requests, {
        userType: 'required|in:bidder,seller',
        name: 'required',
        mobile: 'required',
        countryCode: 'required',
        password: 'required|same:confirm_password',
        businessName: 'requiredIf:userType,seller',
        address: 'requiredIf:userType,seller',
        categories: 'requiredIf:userType,seller',
        lat: 'requiredIf:userType,seller',
        long: 'requiredIf:userType,seller',
        licenceNumber: 'requiredIf:userType,seller',
        // licenceExpiry: 'requiredIf:userType,seller',

      });

      const matched = await v.check();
      if (!matched) {
        return failedValidation(res, v);
      }

      let existingUser = await User.findOne({
        countyCode: requests.countyCode,
        mobile: requests.mobile,
        isDeleted: false
      });

      let userType = requests.userType;
      let isSeller = userType.includes('seller');
      let isBidder = userType.includes('bidder');



      let salt = await bcrypt.genSalt(10);
      let hashPassword = await bcrypt.hashSync(requests.password, salt);
      let nationalIdCardImage = '';

      if (isSeller) {
        if (!req.files) {
          return response(res, 422, i18n.__('File_required'));
        }
        nationalIdCardImage = await FileUpload.aws(req.files.nationalIdCard, 'IdProofImages');
      }
      if (existingUser) {

        // Check resumit seller
        if (existingUser.userType.includes('seller')) {
          if (existingUser.adminVerifyStatus === 'Rejected') {
            // If attempt count exceeds three, return an error
            if (existingUser.isAttemptCount >= 3) {
              return response(res, 422, i18n.__('Max_Attempts_Exceeded'));
            }
            const result = await resubmitInformationForSeller(existingUser, isSeller, nationalIdCardImage, requests, hashPassword);
            if (result.error) {
              return response(res, 422, result.error);
            }
            existingUser.password = undefined
            existingUser.tempPasswords = undefined
            return success(res, i18n.__('Account_Created'), {
              userDetails: existingUser,
              token: await existingUser.generateToken(),
              token_type: 'Bearer',
              expires_in: process.env.JWT_EXPIRY,
            });

          }
        }
        return response(res, 422, i18n.__('Mobile_Already_Exist'));
      }



      // Profile image
      let profileImage = '';
      if (req.files && req.files.profile_image) {
        profileImage = await FileUpload.aws(req.files.profile_image);
      }

      if (requests.lat && requests.long) {
        let coordinates = [parseFloat(requests.long), parseFloat(requests.lat)];
        let location = {
          type: 'Point',
          coordinates,
        };
        requests.location = location;
      }

      requests.password = hashPassword;
      requests.tempPasswords = [hashPassword];
      requests.mobile = requests.mobile;
      requests.countyCode = requests.countyCode;
      requests.email = requests.email ? requests.email : '';
      requests.address = requests.address ? requests.address : '';
      requests.ar_address = requests.ar_address ? requests.ar_address : '';
      requests.userType = requests.userType ? requests.userType : '';
      if (requests.categories) {
        requests.categories = Array.isArray(requests.categories) ? requests.categories : requests.categories.split(",");
        requests.categories = requests.categories.map((category) => ({
          categoryId: new ObjectId(category),
        }));
      }
      requests.licenceNumber = requests.licenceNumber ? requests.licenceNumber : '';
      requests.adminVerifyStatus = (isSeller) ? 'Pending' : 'None';
      requests.licenceExpiry = requests.licenceExpiry ? requests.licenceExpiry : '';
      requests.nationalIdCard = nationalIdCardImage ? nationalIdCardImage.Key : '';
      requests.name = requests.name ? requests.name : '';
      requests.ar_name = requests.ar_name ? requests.ar_name : '';
      requests.laguageName = requests.laguageName ? requests.laguageName : 'en';
      requests.taxRegistrationNumber = requests.taxRegistrationNumber ? requests.taxRegistrationNumber : '';
      requests.profile_image = profileImage ? profileImage.Key : '';



      let created = await User.create(requests);
      let userDetails = {
        ...created.toObject(),
        password: undefined,
        tempPasswords: undefined
      };
      return success(res, i18n.__('Account_Created'), {
        userDetails: userDetails,
        token: await created.generateToken(),
        token_type: 'Bearer',
        expires_in: process.env.JWT_EXPIRY,
      });

    } catch (error) {
      console.log
      dump(error);
      return serverError(res, 500, i18n.__('Internal_Error'));
    }
  },


  // Login
  login: async (req, res) => {
    try {
      console.log('++++++++++', req.body);
      var requests = await decrypter(req.body);
      if (requests == false) {
        return response(res, 500, i18n.__('Internal_Error'));
      }
      const v = new Validator(requests, {
        mobile: 'required',
        countryCode: 'required',
        password: 'required',
      });

      const matched = await v.check();
      if (!matched) {
        return failedValidation(res, v);
      }

      let userExist = await User.findOne({
        countyCode: requests.countyCode,
        mobile: requests.mobile,
        isDeleted: false // Ensure the user is not deleted
      });

      if (!userExist) {
        return response(res, 422, i18n.__('not_register'));
      }

      // Compare the provided password with the stored password hash
      const passwordMatch = await bcrypt.compare(requests.password, userExist.password);

      if (!passwordMatch) {
        return response(res, 422, i18n.__('Incorrect_password'));
      }

      if (userExist.status === false) {
        return authFailed(res, i18n.__("Account_Deactivated"), 402);
      }

      if (userExist.userType.includes('bidder')) {
        // If the user is a bidder, customize the response accordingly
        userExist.deviceType = requests.deviceType
        userExist.deviceToken = requests.deviceToken

        await userExist.save()

        userExist.password = undefined
        userExist.tempPasswords = undefined

        // Create a JWT token
        let token = await userExist.generateToken();
        const responseData = {
          token: token,
          token_type: 'Bearer',
          expires_in: process.env.JWT_EXPIRY,
          userDetails: userExist,
        };

        return success(res, i18n.__('Register'), responseData);
      }
      // Check verification status based on userType
      if (userExist.userType.includes('seller')) {
        // If the user is a seller
        if (userExist.adminVerifyStatus === 'Rejected') {
          if (userExist.isAttemptCount >= 3) {
            return response(res, 425, i18n.__('rejected_isAttempt'), {});
          } else {
            let responseData = {
              rejectedReason: userExist.rejectedReason,
            };
            return response(res, 423, i18n.__('rejected'), responseData);
          }
        } else if (userExist.adminVerifyStatus === 'Pending') {
          return response(res, 424, i18n.__('pending_verification'));
        }
      }


      // Update deviceType and deviceToken
      userExist.deviceType = requests.deviceType
      userExist.deviceToken = requests.deviceToken

      await userExist.save()

      userExist.password = undefined
      userExist.tempPasswords = undefined

      // Create a JWT token
      let token = await userExist.generateToken();
      const responseData = {
        token: token,
        token_type: 'Bearer',
        expires_in: process.env.JWT_EXPIRY,
        userDetails: userExist,
      };

      return success(res, i18n.__('Register'), responseData);
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__('Internal_Error'));
    }
  },


  // Send OTP
  sendOtp: async (req, res) => {
    try {

      var requests = await decrypter(req.body);
      if (requests == false) {
        return response(res, 500, i18n.__('Internal_Error'));
      }
      const v = new Validator(requests, {
        userType: 'required|in:bidder,seller',
        mobile: 'required',
        countryCode: 'required',
      })

      const matched = await v.check()
      if (!matched) {
        return failedValidation(res, v)
      }

      let existingUser = await User.findOne({
        countyCode: requests.countyCode,
        mobile: requests.mobile,
        isDeleted: false
      });

      let userType = requests.userType;
      let isSeller = userType === 'seller';
      let isBidder = userType === 'bidder';

      if (existingUser) {
        if ((existingUser.userType === 'seller' && existingUser.isAttemptCount >= 3) && requests.userType === 'seller') {
          return response(res, 422, i18n.__('rejected_isAttempt'));
        }
        return response(res, 422, i18n.__('Mobile_Already_Exist'));
      }



      const otp = 1234;

      let data = {}

      data = {
        mobile: requests.mobile,
        countryCode: requests.countryCode,
        otp: otp
      }

      await MobileOtpVerification.create(data)


      return success(res, i18n.__('Otp_Sent'))


    } catch (error) {
      dump(error)
      return serverError(res, 500, i18n.__('Internal_Error'))
    }
  },

  //Verify OTP
  verifyOtp: async (req, res) => {
    try {
      var requests = await decrypter(req.body);
      if (requests == false) {
        return response(res, 500, i18n.__('Internal_Error'));
      }
      const v = new Validator(requests, {
        countryCode: 'required',
        mobile: 'required',
        otp: 'required|digits:4'
      })
      const matched = await v.check()
      if (!matched) {
        return failedValidation(res, v)
      }

      userExist = await MobileOtpVerification.findOne({
        mobile: requests.mobile,
        countryCode: requests.countryCode,

      })

      if (!userExist) {
        return response(res, 422, i18n.__('not_found'))
      }
      if (requests.otp != userExist.otp) {
        return response(res, 422, i18n.__('Invalid_otp'))
      }

      await MobileOtpVerification.findByIdAndRemove(userExist._id)
      return success(res, i18n.__('Verified_success'))
    } catch (error) {
      dump(error)
      return serverError(res, 500, i18n.__('Internal_Error'))
    }
  },

  forgotPasswordSendOtp: async (req, res) => {
    try {

      var requests = await decrypter(req.body);
      if (requests == false) {
        return response(res, 500, i18n.__('Internal_Error'));
      }
      const v = new Validator(requests, {
        // userType: 'required|in:bidder,seller',
        mobile: 'required',
        countryCode: 'required',
      })

      const matched = await v.check()
      if (!matched) {
        return failedValidation(res, v)
      }
      let userExist = await User.findOne({
        mobile: requests.mobile,
        countryCode: requests.countryCode,
        isDeleted: false // Ensure the user is not deleted
      });

      if (!userExist) {
        return response(res, 401, i18n.__('not_found'));
      }
      const otp = 1234;

      let data = {}

      data = {
        mobile: requests.mobile,
        countryCode: requests.countryCode,
        otp: otp
      }

      await MobileOtpVerification.create(data)


      return success(res, i18n.__('Otp_Sent'))


    } catch (error) {
      dump(error)
      return serverError(res, 500, i18n.__('Internal_Error'))
    }
  },
  //Reset Password
  resetPassword: async (req, res) => {
    try {
      var requests = await decrypter(req.body);
      if (requests == false) {
        return response(res, 500, i18n.__('Internal_Error'));
      }
      const v = new Validator(requests, {
        countryCode: 'required',
        mobile: 'required',
        newPassword: 'required|same:confirm_newPassword',
      });

      const matched = await v.check()

      if (!matched) {
        return failedValidation(res, v)
      }

      userExist = await User.findOne({
        mobile: requests.mobile,
        countryCode: requests.countryCode,
        isDeleted: false // Ensure the user is not deleted

      });

      if (!userExist) {
        return response(res, 401, i18n.__('not_found'));
      }

      const isPasswordMatched = await bcrypt.compare(requests.newPassword, userExist.password);

      if (isPasswordMatched) {
        return response(res, 422, i18n.__('Password_not_same'));
      }

      const tempPasswords = userExist.tempPasswords || [];
      const isPreviousPassword = tempPasswords.some(password => bcrypt.compareSync(requests.newPassword, password));

      if (isPreviousPassword) {
        return response(res, 422, i18n.__('New_password_same_as_previous'));
      }

      // Store the new password in the tempPasswords array
      tempPasswords.push(userExist.password);
      if (tempPasswords.length > 3) {
        tempPasswords.shift(); // Remove the oldest password from the array if it exceeds 3
      }

      let salt = await bcrypt.genSalt(10);
      let hashPassword = await bcrypt.hashSync(requests.newPassword, salt);

      // Update the user's password and tempPasswords array
      await User.findByIdAndUpdate(
        userExist._id,
        {
          password: hashPassword,
          tempPasswords: tempPasswords
        }
      );

      return response(res, 200, i18n.__('password_reset_success'));
    } catch (error) {
      dump(error)
      return response(res, 500, i18n.__('Internal_Error'))
    }

  },

  checkProfileCompletion: async (req, res) => {

    try {
      var requests = await decrypter(req.body);
      if (requests == false) {
        return response(res, 500, i18n.__('Internal_Error'));
      }
      const v = new Validator(requests, {
        countryCode: 'required',
        mobile: 'required',

      });

      const matched = await v.check()

      if (!matched) {
        return failedValidation(res, v)
      }

      userExist = await User.findOne({
        mobile: requests.mobile,
        countryCode: requests.countryCode,
        isDeleted: false,
      });

      if (!userExist) {
        return response(res, 401, i18n.__('not_found'));
      }
      //check user blocked or not
      if (userExist.status === false) {
        return authFailed(res, i18n.__("Account_Deactivated"), 402);
      }
      // if (userExist.userType.includes('seller')) {
      if (userExist.adminVerifyStatus === 'Accepted') {


        let token = await userExist.generateToken();
        const responseData = {
          token: token,
          token_type: 'Bearer',
          expires_in: process.env.JWT_EXPIRY,
          userDetails: userExist,
          adminVerifyStatus: userExist.adminVerifyStatus,
        };
        return response(res, 200, i18n.__('verified'), responseData);

      } else if (userExist.adminVerifyStatus === 'Rejected') {
        if (userExist.isAttemptCount >= 3) {
          return response(res, 425, i18n.__('rejected_isAttempt'), {});
        }
        const responseData = {
          adminVerifyStatus: userExist.adminVerifyStatus,
          rejectedReason: userExist.rejectedReason

        }
        return response(res, 423, i18n.__('rejected'), responseData);

      } else if (userExist.adminVerifyStatus === 'Pending') {
        return response(res, 424, i18n.__('pending_verification'));
      }

      // }
      return response(res, 426, i18n.__('form_fill'));
    } catch (error) {
      dump(error)
      return response(res, 500, i18n.__('Internal_Error'))
    }

  },

  logout: async (req, res) => {
    try {
      // Decrypt the request body
      const requests = await decrypter(req.body);
      if (!requests) {
        return response(res, 500, i18n.__('Internal_Error'));
      }

      // Validate the decrypted request
      const v = new Validator(requests, {
        userId: 'required',
      });
      const matched = await v.check();
      if (!matched) {
        return failedValidation(res, v);
      }

      // Find the user by userId
      let user = await User.findById(requests.userId);
      if (!user) {
        return response(res, 422, i18n.__('User_Not_Found'));
      }

      // Update deviceToken to blank
      user.deviceToken = '';

      // Save the updated user
      await user.save();

      // Respond with success message
      return success(res, i18n.__('Logout_Successful'), {});
    } catch (error) {
      dump(error)
      return serverError(res, 500, i18n.__('Internal_Error'));
    }
  },

  getCategories: async (req, res) => {
    try {
      // Fetch all categories from the database
      const categories = await Category.find();

      // If no categories are found, respond with an appropriate message
      if (!categories || categories.length === 0) {
        return response(res, 422, i18n.__('NOTFOUND'));
      }

      // Respond with the fetched categories
      return success(res, i18n.__('FETCHDATA'), { categories });
    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__('Internal_Error'));
    }
  }



}
// Helper function for resubmit seller

const resubmitInformationForSeller = async (existingUser, isSeller, nationalIdCardImage, requests, hashPassword) => {
  existingUser.isAttemptCount += 1;
  existingUser.password = hashPassword;
  existingUser.mobile = requests.mobile;
  existingUser.countyCode = requests.countyCode;
  existingUser.email = requests.email ? requests.email : '';
  existingUser.address = requests.address ? requests.address : '';
  existingUser.userType = (isSeller) ? 'seller' : 'bidder';
  if (requests.categories) {
    existingUser.categories = Array.isArray(requests.categories) ? requests.categories : requests.categories.split(",");
    existingUser.categories = requests.categories.map((category) => ({
      categoryId: new ObjectId(category),
    }));
  }
  if (requests.lat && requests.long) {
    let coordinates = [parseFloat(requests.long), parseFloat(requests.lat)];
    let location = {
      type: 'Point',
      coordinates,
    };
    requests.location = location;
  }
  existingUser.location = requests.location;
  existingUser.businessName = requests.businessName;
  existingUser.licenceNumber = requests.licenceNumber ? requests.licenceNumber : '';
  existingUser.adminVerifyStatus = (isSeller) ? 'Pending' : 'None';
  existingUser.licenceExpiry = requests.licenceExpiry ? requests.licenceExpiry : '';
  existingUser.nationalIdCard = nationalIdCardImage ? nationalIdCardImage.Key : '';
  existingUser.name = requests.name ? requests.name : '';
  await existingUser.save();

  return { success: true };
}