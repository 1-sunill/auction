const mongoose = require('mongoose');

const MobileOtpVerification = new mongoose.Schema({
   
    countryCode: {
        type: String,
        required: false
    },
    mobile: {
        type: String,
        required: false
    },
    otp: {
        type: Number,
        required: false
    },

}, {
    timestamps: true
});
module.exports = mongoose.model('MobileOtpVerifications', MobileOtpVerification);