const express = require('express');
const router = express.Router();
const AuthController = require('../../../app/Controllers/api/v1/Auth/AuthController');
const userAuth = require('../../../app/Middleware/userAuth');


router.post('/register', AuthController.register);
router.post('/verifyOtp', AuthController.verifyOtp);
router.post('/logout', userAuth,AuthController.logout);

module.exports = router


