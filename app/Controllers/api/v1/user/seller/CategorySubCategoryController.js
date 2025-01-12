const {
  Validator
} = require('node-input-validator')
const FileUpload = require('../../../../../../services/upload-files')
const Category = require('../../../../../Models/Category')
const User = require('../../../../../Models/User')
const SubCategory = require('../../../../../Models/SubCategory');
const bcrypt = require('bcrypt')
const i18n = require("i18n")
const mongoose = require('mongoose')
const {
  ObjectId
} = require('mongodb');

const {
  success,
  response,
  failedValidation,
  failed,
  authFailed,
  serverError
} = require('../../../../../../helper/response')
const {
  decrypter
} = require('../../../../../../helper/crypto');
const {
  dump
} = require('../../../../../../helper/logs');

module.exports = {

  getCategoriesWithSubcategories: async (req, res) => {
    try {
      // Decrypt the request body
      var requests = await decrypter(req.body);
      if (requests == false) {
        return response(res, 500, i18n.__('Internal_Error'));
      }

      // Validate the decrypted request
      const v = new Validator(requests, {});
      const matched = await v.check();
      if (!matched) {
        return failedValidation(res, v);
      }

      // Fetch the authenticated user's ID
      const userId = req.user._id;

      // Fetch the authenticated user's associated categories
      const userCategories = await User.findById(userId).select('categories -_id').lean();

      const categoryIds = userCategories.categories.map(category => category.categoryId.toString());

      const categories = await Category.find({ _id: { $in: categoryIds }, status: true });

      if (!categories || categories.length === 0) {
        return response(res, 401, i18n.__('NOTFOUND'), {});
      }

      // Populate subcategories for each category
      const categoriesWithSubcategories = await Promise.all(categories.map(async (category) => {
        const subCategories = await SubCategory.find({ categoryId: category._id, status: true });
        return {
          ...category.toObject(),
          subCategories
        };
      }));

      return success(res, i18n.__('FETCHDATA'), { categoriesWithSubcategories });

    } catch (error) {
      console.error(error);
      return serverError(res, 500, i18n.__('Internal_Error'));
    }
  }
};
