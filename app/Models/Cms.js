const mongoose = require('mongoose');

const cms = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: ["privacy", "terms", "cancelPolicy","about"],
        default: "privacy"
    },
    slug: {
        type: String,
        required: true,
        enum: ["privacy-policy", "terms-and-conditions","cancellation-policy","about-us"],
        default: "privacy-policy"
    },
    description: {
        type: String,
        required: true
    },
    userType: {
        type: String,
        enum: ['bidder', 'seller'],
        default: "seller"
    }

}, {
    timestamps: true
});
module.exports = mongoose.model('cms', cms);