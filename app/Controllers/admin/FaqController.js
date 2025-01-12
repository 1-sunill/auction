const { Validator } = require('node-input-validator')
const Faq = require('../../../app/Models/Faq')
const Category = require('../../../app/Models/Category');
const response = require('../../../helper/helper')
const FileUpload = require('../../../services/upload-files')
const {
  serverError,
  validateFail,
  failed,
  success,
} = require('../../../helper/helper')

module.exports = {
  addFaq: async (req, res) => {
    try {
      const v = new Validator(req.body, {
        title: 'required',
        description: 'required',
        titleArabic: 'required',
        descriptionArabic: 'required',
        user_type: 'required|in:bidder,seller',
      })

      const matched = await v.check()
      if (!matched) {
        return validateFail(res, v)
      }
      let { title } = req.body
      const { description, user_type, titleArabic, descriptionArabic } = req.body

      title = title.charAt(0).toUpperCase() + title.slice(1);

      const existCheck = await Faq.findOne({ title, user_type })
      const existarCheck = await Faq.findOne({ titleArabic, user_type })

      if (existCheck) {
        return failed(res, 'Faq Already Exists in English!', {})
      }
      if (existarCheck) {
        return failed(res, 'Faq Already Exists in Arabic!', {})
      }

      const newFaq = new Faq({
        title,
        titleArabic,
        descriptionArabic,
        description,
        user_type,
      })

      await newFaq.save()

      return success(res, 'Faq added successfully!', newFaq)
    } catch (error) {
      console.error(error)
      return serverError(res, 'Internal Server Error')
    }
  },

  editFaq: async (req, res) => {
    try {
      const v = new Validator(req.body, {
        faqId: 'required',
        user_type: 'required',
      })

      const matched = await v.check()
      if (!matched) {
        return validateFail(res, v)
      }

      const { title, description, titleArabic, descriptionArabic, user_type, faqId } = req.body

      const faq = await Faq.findById(faqId)
      if (!faq) {
        return failed(res, 'FAQ not found.', {})
      }

      const existingFaq = await Faq.findOne({
        title,
        user_type,
        _id: { $ne: faqId },
      })

      if (existingFaq) {
        return failed(
          res,
          'FAQ with this title, category, and user type already exists!',
          {},
        )
      }

      const updateObject = {
        title,
        description,
        titleArabic,
        descriptionArabic,
        user_type,
      }

      // Use findOneAndUpdate to update the FAQ
      const updatedFaq = await Faq.findOneAndUpdate(
        { _id: faqId },
        updateObject,
        { new: true },
      )

      if (!updatedFaq) {
        return failed(res, 'Error updating FAQ.', {})
      }

      return success(res, 'FAQ updated Successfully!', updatedFaq)
    } catch (error) {
      console.error(error)
      return serverError(res, 'Internal Server Error')
    }
  },

  getFaq: async (req, res) => {
    const ITEMS_PER_PAGE = 10
    try {
      const { page = 1, search, user_type } = req.query

      let query = {}

      // If search parameter is provided, add it to the query
      if (search) {
        query.title = { $regex: new RegExp(search, 'i') } // Case-insensitive search
      }

      if (user_type) {
        query.user_type = user_type
      }

      const totalItems = await Faq.countDocuments(query)
      const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE)

      const faqList = await Faq.find(query)
        .sort({ createdAt: -1 }) // Sort by createdAt in descending order
        .skip((page - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE)

      // Check if data is empty
      if (faqList.length === 0) {
        return failed(res, 'No faqs found.', {})
      }

      return success(res, 'Faq fetched successfully!', {
        faqList,
        pagination: {
          totalItems,
          totalPages,
          currentPage: page,
          itemsPerPage: ITEMS_PER_PAGE,
        },
      })
    } catch (error) {
      console.error(error)
      return serverError(res, 'Internal Server Error')
    }
  },
  getFaqCategories: async (req, res) => {
    try {
      const query = {
        status: true,
        type: 'faq',
      };

      const categoryList = await Category.find(query);

      // Process image URLs
      categoryList.forEach((category) => {
        // Access the imageUrl virtual property
        category.imageUrl = category.imageUrl;
      });

      // Check if data is empty
      if (categoryList.length === 0) {
        return failed(res, 'No categories found.', {});
      }

      return success(res, 'Categories fetched successfully!', {
        categoryList,
      });
    } catch (error) {
      console.error(error);
      return serverError(res, 'Internal Server Error');
    }
  },

  deleteFaq: async (req, res) => {
    try {
      const faqId = req.params.id
      if (!faqId) {
        return failed(res, 'FaqId required')
      }
      const deletedFaq = await Faq.findByIdAndRemove(faqId)
      if (!deletedFaq) {
        return failed(res, 'Data Not deleted')
      }
      return success(res, 'Faq deleted successfully!')
    } catch (error) {
      console.error(error)
      return serverError(res, 'Internal Server Error')
    }
  },

  singleDetails: async (req, res) => {
    try {
      const faqId = req.params.id

      const faq = await Faq.findById(faqId)
      if (!faq) {
        return failed(res, 'Faq not found.', {})
      }

      return success(res, 'Faq fetch Successfully!', faq)
    } catch (error) {
      console.error(error)
      return serverError(res, 'Internal Server Error')
    }
  },

  statusChange: async (req, res) => {
    try {
      const v = new Validator(req.body, {
        faqId: 'required',
        status: 'required',
      })

      const matched = await v.check()
      if (!matched) {
        return validateFail(res, v)
      }

      const { status, faqId } = req.body

      const faq = await Faq.findById(faqId)
      if (!faq) {
        return failed(res, 'Faq not found.', {})
      }

      // Update the category status
      faq.status = status
      await faq.save()

      return success(res, 'Faq status updated successfully!', faq)
    } catch (error) {
      console.error(error)
      return serverError(res, 'Internal Server Error')
    }
  },
};
