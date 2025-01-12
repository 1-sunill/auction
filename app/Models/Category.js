const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    enName:{type:String, required:true},
    arName:{type:String, required:true},
    image:{type:String, default: null },
    status: {
        type: Boolean,
        default: true, // Default value is true (Active)
    },
},
{
        
    timestamps:true,

}
);

// Define a virtual property 'imageUrl' that concatenates the base URL with the image field
categorySchema.virtual('imageUrl').get(function () {
    if (this.image) {
        return process.env.AWS_URL + this.image; 
    }
    return null;
});

// Ensure virtuals are included in JSON output
categorySchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
      // Remove the "id" property from the JSON output
      delete ret.image;
      delete ret.id;
    },
  });


module.exports = mongoose.model('categories',categorySchema);