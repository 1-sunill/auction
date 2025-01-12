const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema({
    title:{type:String, required:false},
    titleArabic: {type: String,required:false },
    user_type: {
        type: String,
        enum: ["bidder", "seller"],
      },
    description:{type:String, default: null },
    descriptionArabic :{type:String, default: null },
    status: {
        type: Boolean,
        default: true, // Default value is false (Inactive)
    }
 
},
{
        
    timestamps:true,

}
);



module.exports = mongoose.model('faqs',faqSchema);