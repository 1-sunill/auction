const express = require("express");
const AuthController = require("../../../../app/Controllers/api/v1/user/AuthController");
const userAuth = require('../../../../app/Middleware/userAuth');
const ProfileController = require("../../../../app/Controllers/api/v1/user/ProfileController");
const router = express.Router();
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/send/otp', AuthController.sendOtp);
router.post('/verify/otp', AuthController.verifyOtp);
router.post('/forgotPassword/sendOtp', AuthController.forgotPasswordSendOtp);
router.post('/resetPassword',AuthController.resetPassword);
router.post('/check-profile',AuthController.checkProfileCompletion);
router.post('/logout', userAuth,AuthController.logout);


//get Categories Route
router.get('/getCategories', AuthController.getCategories);
router.get("/notification-list", userAuth, ProfileController.notificationList);
module.exports = router;