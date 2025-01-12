const {
  Validator
} = require('node-input-validator')
const SubCategory = require('../../../app/Models/SubCategory')
const Category = require('../../../app/Models/Category')
const response = require('../../../helper/helper')
const FileUpload = require('../../../services/upload-files')
const {
  serverError,
  validateFail,
  failed,
  success,
} = require('../../../helper/helper')


module.exports = {

  addSubCategory: async (req, res) => {
    try {
      const v = new Validator(req.body, {
        categoryId: 'required',
        enName: 'required',
        arName: 'required',
      })

      const matched = await v.check()
      if (!matched) {
        return validateFail(res, v)
      }

      let {
        arName,
        enName,
        categoryId
      } = req.body

      // Convert the first letter of enName to uppercase
      enName = enName.charAt(0).toUpperCase() + enName.slice(1);

      // Check if the categoryId exists
      const category = await Category.findById(categoryId)
      if (!category) {
        return failed(res, 'Category not found.', {})
      }


      // Check if a subcategory with the same English name exists
      const existCheckEn = await SubCategory.findOne({
        enName
      })
      if (existCheckEn) {
        return failed(res, 'Subcategory with English name already exists!', {})
      }

      // Check if a subcategory with the same Arabic name exists
      const existCheckAr = await SubCategory.findOne({
        arName
      })
      if (existCheckAr) {
        return failed(res, 'Subcategory with Arabic name already exists!', {})
      }



      const newSubCategory = new SubCategory({
        enName,
        arName,
        categoryId,

      })

      await newSubCategory.save()

      return success(res, 'Subcategory added successfully!', newSubCategory)
    } catch (error) {
      console.error(error)
      return serverError(res, 'Internal Server Error')
    }
  },

  editSubCategory: async (req, res) => {
    try {
      const v = new Validator(req.body, {
        subCategoryId: 'required',
        enName: 'required',
        arName: 'required',
      });

      const matched = await v.check();
      if (!matched) {
        return validateFail(res, v);
      }

      let {
        enName,
        arName,
        subCategoryId
      } = req.body;

      // Convert the first letter of enName to uppercase
      enName = enName.charAt(0).toUpperCase() + enName.slice(1);

      const subCategory = await SubCategory.findById(subCategoryId);
      if (!subCategory) {
        return failed(res, 'SubCategory not found.', {});
      }

      // Check if a subcategory with the same English name exists
      const existingSubCategoryEn = await SubCategory.findOne({
        enName,
        _id: {
          $ne: subCategoryId
        }
      });
      if (existingSubCategoryEn) {
        return failed(res, 'SubCategory with this English name already exists!', {});
      }

      // Check if a subcategory with the same Arabic name exists
      const existingSubCategoryAr = await SubCategory.findOne({
        arName,
        _id: {
          $ne: subCategoryId
        }
      });
      if (existingSubCategoryAr) {
        return failed(res, 'SubCategory with this Arabic name already exists!', {});
      }

      const updateObject = {
        enName,
        arName,
      };

      if (req.files && req.files.image) {
        const newImageFileName = await FileUpload.aws(req.files.image);
        updateObject.image = newImageFileName.Key;
      }

      const updatedSubCategory = await SubCategory.findOneAndUpdate({
        _id: subCategoryId
      },
        updateObject, {
        new: true
      }
      );

      if (!updatedSubCategory) {
        return failed(res, 'Error updating subCategory.', {});
      }

      return success(res, 'SubCategory updated Successfully!', updatedSubCategory);
    } catch (error) {
      console.error(error);
      return serverError(res, 'Internal Server Error');
    }
  },

  getSubCategories: async (req, res) => {
    const ITEMS_PER_PAGE = 10;
    try {
      const { page = 1, search } = req.query;
      let query = {};

      // If search parameter is provided, add it to the query
      if (search) {
        query.$or = [
          { enName: { $regex: new RegExp(search, 'i') } },
          { arName: { $regex: new RegExp(search, 'i') } }
        ];
      }

      const totalItems = await SubCategory.countDocuments(query);
      const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

      const subCategorylist = await SubCategory.find(query)
        .sort({ createdAt: -1 }) // Sort by createdAt in descending order
        .skip((page - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE)
        .populate('categoryId', 'enName arName')

      // Check if data is empty
      if (subCategorylist.length === 0) {
        return failed(res, 'No subCategories found.', {});
      }

      const formattedSubCategories = subCategorylist.map(subCategory => ({
        categoryId: {
          _id: subCategory.categoryId._id,
          enName: subCategory.categoryId.enName,
          arName: subCategory.categoryId.arName
        },
        _id: subCategory._id,
        enName: subCategory.enName,
        arName: subCategory.arName,
        imageUrl: subCategory.imageUrl,
        status: subCategory.status,
        createdAt: subCategory.createdAt,
        updatedAt: subCategory.updatedAt,
        __v: subCategory.__v
      }));

      return success(res, 'SubCategories fetched successfully!', {
        subCategorylist: formattedSubCategories,
        pagination: {
          totalItems,
          totalPages,
          currentPage: page,
          itemsPerPage: ITEMS_PER_PAGE,
        },
      });
    } catch (error) {
      console.error(error);
      return serverError(res, 'Internal Server Error');
    }
  },

  singleDetails: async (req, res) => {
    try {
      const subCategoryId = req.params.id

      const subCategory = await SubCategory.findById(subCategoryId)
      if (!subCategory) {
        return failed(res, 'SubCategory not found.', {})
      }

      return success(res, 'SubCategory fetch Successfully!', subCategory)
    } catch (error) {
      console.error(error)
      return serverError(res, 'Internal Server Error')
    }
  },

  statusChange: async (req, res) => {
    try {
      const v = new Validator(req.body, {
        status: 'required',
        subCategoryId: 'required',
      })

      const matched = await v.check()
      if (!matched) {
        return validateFail(res, v)
      }

      const {
        status,
        subCategoryId
      } = req.body

      const subCategory = await SubCategory.findById(subCategoryId)
      if (!subCategory) {
        return failed(res, 'Category not found.', {})
      }

      // Update the category status
      subCategory.status = status
      await subCategory.save()

      return success(res, 'SubCategory status updated successfully!', subCategory)
    } catch (error) {
      console.error(error)
      return serverError(res, 'Internal Server Error')
    }
  },
};