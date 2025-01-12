const mongoose = require('mongoose');

const adminNotificationSchema = new mongoose.Schema(
  {
    userType: {
      type: String,
      enum: ['bidder', 'seller'],
      required: true,
    },
    title:{
        type:String,
        default:null
    },
    type:{
        type:String,
        default:"All"
    },
    scheduleDateTime : {
        type: String,
        default: null
    },
    message: {
      type: String,
      required: true,
    }    
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AdminNotification', adminNotificationSchema);
