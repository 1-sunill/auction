const { Validator } = require('node-input-validator')
const Cms = require('../../../app/Models/Cms')
const response = require('../../../helper/helper')
const FileUpload = require('../../../services/upload-files');
const {
  serverError,
  validateFail,
  failed,
  success,
} = require('../../../helper/helper')

module.exports = {
  addCms: async (req, res) => {
    try {
      const v = new Validator(req.body, {
        type: 'required|in:privacy,terms,cancelPolicy,about',
        description: 'required',
        user_type: 'required|in:bidder,seller',
      })

      const matched = await v.check()
      if (!matched) {
        return validateFail(res, v);
      }

      const { type, description, user_type } = req.body;


      const existCheck = await Cms.findOne({ type, userType: user_type, description });

      if (existCheck) {
        return failed(res, 'Cms Already Exists!', {});
      }

      // Determine slug based on type
      let slug;
      if (type === 'privacy') {
        slug = 'privacy-policy';
      } if (type === 'cancelPolicy') {
        slug = 'cancellation-policy'
      } if (type === 'about') {
        slug = 'about-us'
      }
      else {
        slug = 'terms-and-conditions';
      }

      const newCms = new Cms({
        type,
        description,
        userType: user_type,
        slug,
      });

      await newCms.save()

      return success(res, 'Cms added successfully!', newCms)
    } catch (error) {
      console.error(error)
      return serverError(res, 'Internal Server Error')
    }
  },

  editCms: async (req, res) => {
    try {
      const v = new Validator(req.body, {
        type: 'required|in:privacy,terms,cancelPolicy,about',
        user_type: 'required|in:bidder,seller',
        description: 'required',
      });

      const matched = await v.check();
      if (!matched) {
        return validateFail(res, v);
      }

      const { type, description, user_type } = req.body;

      const cms = await Cms.findOne({ type, userType: user_type });
      if (!cms) {
        return failed(res, 'Cms not found.', {});
      }

      // Determine slug based on type
      let slug;
      if (type === 'privacy') {
        slug = 'privacy-policy';
      } if (type === 'cancelPolicy') {
        slug = 'cancellation-policy'
      } if (type === 'about') {
        slug = 'about-us'
      }
      else {
        slug = 'terms-and-conditions';
      }

      // Update the CMS document
      cms.type = type;
      cms.description = description;
      cms.userType = user_type;
      cms.slug = slug;

      // Save the changes
      const updatedCms = await cms.save();

      return success(res, 'CMS updated Successfully!', updatedCms);
    } catch (error) {
      console.error(error);
      return serverError(res, 'Internal Server Error');
    }
  },


  getCms: async (req, res) => {
    const ITEMS_PER_PAGE = 10
    try {
      const { page = 1, search, user_type } = req.query;

      let query = {}

      // If search parameter is provided, add it to the query
      if (search) {
        query.name = { $regex: new RegExp(search, 'i') } // Case-insensitive search
      }

      if (user_type) {
        query.userType = user_type;
      }

      const totalItems = await Cms.countDocuments(query)
      const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE)

      const cmsList = await Cms.find(query)
        .sort({ createdAt: -1 }) // Sort by createdAt in descending order
        .skip((page - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE)


      // Check if data is empty
      if (cmsList.length === 0) {
        return failed(res, 'No cms found.', {})
      }

      return success(res, 'Cms fetched successfully!', {
        cmsList,
        pagination: {
          totalItems,
          totalPages,
          currentPage: page,
          itemsPerPage: ITEMS_PER_PAGE,
        },
      });
    } catch (error) {
      console.error(error)
      return serverError(res, 'Internal Server Error')
    }
  },

  deleteCms: async (req, res) => {
    try {
      const cmsId = req.params.id;
      if (!cmsId) {
        return failed(res, 'CmsId required');
      }
      const deletedCms = await Cms.findByIdAndRemove(cmsId);
      if (!deletedCms) {
        return failed(res, 'Data Not deleted');
      }
      return success(res, 'Cms deleted successfully!')
    } catch (error) {
      console.error(error)
      return serverError(res, 'Internal Server Error')
    }
  },

  singleDetails: async (req, res) => {
    try {
      const query = {
        type: req.query.type,
        userType: req.query.user_type,
      };

      const cms = await Cms.findOne(query)
      if (!cms) {
        return failed(res, 'Cms not found.', {})
      }

      return success(res, 'Cms fetch Successfully!', cms)
    } catch (error) {
      console.error(error)
      return serverError(res, 'Internal Server Error')
    }
  },

  statusChange: async (req, res) => {
    try {
      const v = new Validator(req.body, {
        cmsId: 'required',
        status: 'required',
      })

      const matched = await v.check()
      if (!matched) {
        return validateFail(res, v)
      }

      const { status, cmsId } = req.body;

      const cms = await Cms.findById(cmsId);
      if (!cms) {
        return failed(res, 'Cms not found.', {});
      }




      // Update the category status
      cms.status = status;
      await cms.save();

      return success(res, 'Cms status updated successfully!', cms);
    } catch (error) {
      console.error(error);
      return serverError(res, 'Internal Server Error');
    }
  },
};
