const { Validator } = require("node-input-validator");
const Category = require("../../../app/Models/Category");
const response = require("../../../helper/helper");
const FileUpload = require("../../../services/upload-files");
const {
  serverError,
  validateFail,
  failed,
  success,
} = require("../../../helper/helper");

module.exports = {
  addCategory: async (req, res) => {
    try {
      const v = new Validator(req.body, {
        enName: "required",
        arName: "required",
      });

      const matched = await v.check();
      if (!matched) {
        return validateFail(res, v);
      }

      let { enName, arName } = req.body;

      // Convert the first letter of enName to uppercase
      enName = enName.charAt(0).toUpperCase() + enName.slice(1);

      let fileName = "";

      // Check if a category with the same English name exists
      const existCheckEn = await Category.findOne({ enName });
      if (existCheckEn) {
        return failed(res, "Category with English name already exists!", {});
      }

      // Check if a category with the same Arabic name exists
      const existCheckAr = await Category.findOne({ arName });
      if (existCheckAr) {
        return failed(res, "Category with Arabic name already exists!", {});
      }

      if (!req.files) {
        return failed(res, "Image field is required", {});
      }

      fileName = await FileUpload.aws(req.files.image);

      const newCategory = new Category({
        arName,
        enName,
        image: fileName ? fileName.Key : "",
      });

      await newCategory.save();

      return success(res, "Category added successfully!", newCategory);
    } catch (error) {
      console.error(error);
      return serverError(res, "Internal Server Error");
    }
  },

  editCategory: async (req, res) => {
    try {
      const v = new Validator(req.body, {
        categoryId: "required",
        enName: "required",
        arName: "required",
      });

      const matched = await v.check();
      if (!matched) {
        return validateFail(res, v);
      }

      const { enName, arName, categoryId } = req.body;

      // Convert the first letter of enName to uppercase
      enName = enName.charAt(0).toUpperCase() + enName.slice(1);

      const category = await Category.findById(categoryId);
      if (!category) {
        return failed(res, "Category not found.", {});
      }

      const existingCategoryEn = await Category.findOne({
        enName,
        _id: { $ne: categoryId },
      });

      if (existingCategoryEn) {
        return failed(
          res,
          "Category with this English name already exists!",
          {}
        );
      }

      const existingCategoryAr = await Category.findOne({
        arName,
        _id: { $ne: categoryId },
      });

      if (existingCategoryAr) {
        return failed(
          res,
          "Category with this Arabic name already exists!",
          {}
        );
      }

      const updateObject = {
        enName,
        arName,
      };

      // If a new image is provided, update the image field in the update object
      if (req.files && req.files.image) {
        const newImageFileName = await FileUpload.aws(req.files.image);
        updateObject.image = newImageFileName.Key;
      }

      // Use findOneAndUpdate to update the category
      const updatedCategory = await Category.findOneAndUpdate(
        { _id: categoryId },
        updateObject,
        { new: true }
      );

      if (!updatedCategory) {
        return failed(res, "Error updating category.", {});
      }

      return success(res, "Category updated Successfully!", updatedCategory);
    } catch (error) {
      console.error(error);
      return serverError(res, "Internal Server Error");
    }
  },

  getCategories: async (req, res) => {
    const ITEMS_PER_PAGE = 10;
    try {
      const { page = 1, search } = req.query;
      let query = {};

      // If search parameter is provided, add it to the query
      if (search) {
        query.$or = [
          { enName: { $regex: new RegExp(search, "i") } }, // Case-insensitive search for English name
          { arName: { $regex: new RegExp(search, "i") } }, // Case-insensitive search for Arabic name
        ];
      }

      const totalItems = await Category.countDocuments(query);
      const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

      // const categorylist = await Category.find(query)
      //   .sort({ createdAt: -1 }) // Sort by createdAt in descending order
      //   .skip((page - 1) * ITEMS_PER_PAGE)
      //   .limit(ITEMS_PER_PAGE)

      const categorylist = await Category.aggregate([
        { $match: query }, // Apply your query filters here
        {
          $lookup: {
            from: "subcategories", // The name of the SubCategory collection
            localField: "_id",
            foreignField: "categoryId",
            as: "subcategories",
          },
        },
        {
          $addFields: {
            subCategoryCount: { $size: "$subcategories" },
          },
        },
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "categoryId",
            as: "products",
          },
        },
        {
          $addFields: {
            productsCount: { $size: "$products" },
          },
        },
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "categoryId",
            as: "products",
          },
        },
        {
          $addFields: {
            productsCount: { $size: "$products" },
          },
        },
        { $sort: { createdAt: -1 } }, // Sort by createdAt in descending order
        { $skip: (page - 1) * ITEMS_PER_PAGE },
        { $limit: ITEMS_PER_PAGE },
        {
          $project: {
            _id: 1,
            enName: 1,
            arName: 1,
            status: 1,
            subCategoryCount: 1,
            productsCount: 1,
            image: { $concat: [process.env.AWS_URL, "$image"] },
          },
        },
      ]);

      // Check if data is empty
      if (categorylist.length === 0) {
        return failed(res, "No categories found.", {});
      }

      return success(res, "Categories fetched successfully!", {
        categorylist,
        pagination: {
          totalItems,
          totalPages,
          currentPage: page,
          itemsPerPage: ITEMS_PER_PAGE,
        },
      });
    } catch (error) {
      console.error(error);
      return serverError(res, "Internal Server Error");
    }
  },

  deleteCategory: async (req, res) => {
    try {
      const categoryId = req.params.id;
      if (!categoryId) {
        return failed(res, "CategoryId required");
      }
      const deletedCategory = await Category.findByIdAndRemove(categoryId);
      if (!deletedCategory) {
        return failed(res, "Data Not deleted");
      }
      return success(res, "Category deleted successfully!");
    } catch (error) {
      console.error(error);
      return serverError(res, "Internal Server Error");
    }
  },

  singleDetails: async (req, res) => {
    try {
      const categoryId = req.params.id;

      const category = await Category.findById(categoryId);
      if (!category) {
        return failed(res, "Category not found.", {});
      }

      return success(res, "Category fetch Successfully!", category);
    } catch (error) {
      console.error(error);
      return serverError(res, "Internal Server Error");
    }
  },

  statusChange: async (req, res) => {
    try {
      const v = new Validator(req.body, {
        status: "required",
        categoryId: "required",
      });

      const matched = await v.check();
      if (!matched) {
        return validateFail(res, v);
      }

      const { status, categoryId } = req.body;

      const category = await Category.findById(categoryId);
      if (!category) {
        return failed(res, "Category not found.", {});
      }

      // Update the category status
      category.status = status;
      await category.save();

      return success(res, "Category status updated successfully!", category);
    } catch (error) {
      console.error(error);
      return serverError(res, "Internal Server Error");
    }
  },
};
