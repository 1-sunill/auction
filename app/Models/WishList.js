const mongoose = require('mongoose');

const wishListSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users"
    }, 
    products: [{
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'products', // assuming you have a Category model
        },
      }],
      sellers: [{
        sellerId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'users', // assuming you have a User model
        },
      }],  
},
{
        
    timestamps:true,

}
);



module.exports = mongoose.model('wishlists', wishListSchema);