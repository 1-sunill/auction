const mongoose = require('mongoose');

const masterSchema = new mongoose.Schema({
    invoice:{type:String, required:false},
    vatAmount:{
        type:Number, 
        required:false,
        default: 10
    },
    orderTime: {
        type:Number, 
        required:false,
        default: 20
    }, 
    deliveryFee: {
        type:Number, 
        required:false,
        default: 10
    }, 
    cancellationCharge: {
        type:Number, 
        required:false,
        default: 5
    }, 
 
},
{ timestamps:true,}
);
module.exports = mongoose.model('masters',masterSchema);