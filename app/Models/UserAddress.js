const mongoose = require('mongoose');

const userAddressSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users"
    },
    userType: {
        type: String,
        enum: ['bidder', 'seller'], // Enum values for userType
        default: 'bidder'
    },
    name: {
        type: String
    },
    mobile: {
        type: String
    },
    countryCode: {
        type: String
    },
    address: {
        type: String
    },
    country: {
        type: String
    },
    state: {
        type: String
    },
    city: {
        type: String
    },
    zipcode: {
        type: Number
    },
    location: {
        type: {
            type: String,
            default: "Point",
        },
        coordinates: {
            type: [Number],
            default: [0, 0] //[longitude,latitude]
        },
    },
    status: {
        type: Boolean,
        default: true,
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
}, {

    timestamps: true,

});
userAddressSchema.index({
    location: "2dsphere"
});


module.exports = mongoose.model('useraddresses', userAddressSchema);