const {
  serverError,
  success,
  validateFail,
  failed,
} = require("../../../helper/helper");
const Modules = require("../../Models/Modules");
const Permission = require("../../Models/Permission");
const Admin = require("../../Models/Admin");
const { Validator } = require("node-input-validator");
const { ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");
const randomId = () => {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 4; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};
module.exports = {
  moduleList: async (req, res) => {
    console.log("erewrwerw");
    try {
      const modulesList = await Modules.find();
      success(res, "Data fetched successfully.", modulesList);
    } catch (error) {
      serverError(res, "Internal server error");
    }
  },

  addSubadmin: async (req, res) => {
    try {
      const validate = new Validator(req.body, {
        adminName: "required",
        mobile: "required",
        email: "required|email",
        password: "required",
        roles: "required|array",
      });
      const matched = await validate.check();
      if (!matched) {
        validateFail(res, validate);
        return; // Stop execution if validation fails
      }

      const { adminName, mobile, email, password, address } = req.body;
      const existingAdmin = await Admin.findOne({ email });
      if (existingAdmin) {
        failed(res, "Subadmin already exists");
        return; // Stop execution if admin exists
      }

      const salt = await bcrypt.genSalt(10); // Increased the salt rounds
      const hashedPassword = await bcrypt.hash(password, salt);
      const newAdminId = `Abcd-${randomId()}-${randomId()}`;
      const newAdmin = await Admin.create({
        adminId: newAdminId,
        name: adminName,
        email: email,
        password: hashedPassword,
        mobile: mobile,
        address: address,
      });

      for (let i = 0; i < req.body.roles.length; i++) {
        const element = req.body.roles[i];
        const reqData = {
          adminId: newAdmin._id,
          moduleId: element.moduleId,
          roles: element.permission,
        };
        await Permission.create(reqData);
      }

      success(res, "Data inserted successfully.");
    } catch (error) {
      console.log({ error });
      serverError(res, "Internal server error");
    }
  },

  subadminList: async (req, res) => {
    try {
      let {
        page = 1,
        pageSize = 10,
        search = "",
        category = "",
        startDate,
        endDate,
        sortBy,
      } = req.query;
      let sortOptions = { createdAt: -1 };
      
      page = parseInt(page);
      pageSize = parseInt(pageSize);
      const skipIndex = (page - 1) * pageSize;
      const list = await Admin.aggregate([
        { $match: { roleType: 2 } },
        {
          $lookup: {
            from: "permissions",
            localField: "_id",
            foreignField: "adminId",
            as: "permissions",
          },
        },
        { $unwind: { path: "$permissions" } },
        {
          $lookup: {
            from: "modules",
            localField: "permissions.moduleId",
            foreignField: "_id",
            as: "modules",
          },
        },
        {
          $project: {
            _id: 1,
            adminId: 1,
            name: 1,
            email: 1,
            mobile: 1,
            address: 1,
            roleType: 1,
            status: 1,
            createdAt: 1,
            "permissions._id": 1,
            "permissions.adminId": 1,
            "permissions.moduleId": 1,
            "permissions.roles": 1,
            "modules._id": 1,
            "modules.name": 1,
          },
        },
        {
          $group: {
            _id: "$_id",
            adminId: { $first: "$adminId" },
            name: { $first: "$name" },
            email: { $first: "$email" },
            mobile: { $first: "$mobile" },
            address: { $first: "$address" },
            roleType: { $first: "$roleType" },
            status: { $first: "$status" },
            permissions: { $push: "$permissions" },
            modules: { $push: "$modules" },
          },
        },
        {
          $sort: sortOptions,
        },
        {
          $skip: skipIndex,
        },
        {
          $limit: pageSize,
        },
      ]);

      success(res, "Data fetched successfully.", list);
    } catch (error) {
      console.log({ error });
      serverError(res, "Internal server error");
    }
  },

  subAdminDetails: async (req, res) => {
    try {
      const validate = new Validator(req.query, {
        adminId: "required",
      });
      const matched = await validate.check();
      if (!matched) {
        validateFail(res, validate);
      }
      const adminId = new ObjectId(req.query.adminId);
      const detail = await Admin.aggregate([
        { $match: { roleType: 2, _id: adminId } },
        {
          $lookup: {
            from: "permissions",
            localField: "_id",
            foreignField: "adminId",
            as: "permissions",
          },
        },
        // { $unwind: { path: "$permissions" } },
        {
          $lookup: {
            from: "modules",
            localField: "permissions.moduleId",
            foreignField: "_id",
            as: "modules",
          },
        },
        {
          $project: {
            _id: 1,
            adminId: 1,
            name: 1,
            email: 1,
            mobile: 1,
            address: 1,
            roleType: 1,
            "permissions._id": 1,
            "permissions.adminId": 1,
            "permissions.moduleId": 1,
            "permissions.roles": 1,
            "modules._id": 1,
            "modules.name": 1,
          },
        },
      ]);
      let data = [];
      if (detail.length > 1) {
        let [firstInd, ...restInd] = detail;
        data = [
          firstInd,
          ...restInd.map(({ permissions, modules }) => ({
            permissions,
            modules,
          })),
        ];
      } else {
        data = detail;
      }
      if (!detail) {
        failed(res, "Admin not found");
      }
      success(res, "Data fetched successfully.", data);
    } catch (error) {
      serverError(res, "Internal server error");
    }
  },

  updateSubadmin: async (req, res) => {
    try {
      const validate = new Validator(req.body, {
        adminId: "required",
        roles: "required|array",
      });
      const matched = await validate.check();
      if (!matched) {
        validateFail(res, validate);
        return; // Added return to stop execution if validation fails
      }
      const adminData = {
        name: req.body.adminName,
        mobile: req.body.mobile,
        address: req.body.address,
      };
      if (adminData) {
        await Admin.updateOne(
          { _id: req.body.adminId },
          {
            $set: adminData,
          }
        );
      }
      // Delete existing permissions related to the adminId
      await Permission.deleteMany({ adminId: req.body.adminId });

      // Create new permissions based on the roles in the request body
      const newPermissions = req.body.roles.map((element) => ({
        adminId: req.body.adminId,
        moduleId: element.moduleId,
        roles: element.permission,
      }));
      await Permission.insertMany(newPermissions);

      success(res, "Data updated successfully.");
    } catch (error) {
      console.log({ error });
      serverError(res, "Internal server error");
    }
  },
  subadminStatus: async (req, res) => {
    try {
      const validate = new Validator(req.body, {
        id: "required",
      });

      const matched = await validate.check();

      if (!matched) {
        return validateFail(res, validate);
      }

      const subAdmin = await Admin.findById(req.body.id);

      if (!subAdmin) {
        return failed(res, "Sub admin not found.");
      }

      subAdmin.status = subAdmin.status === 0 ? 1 : 0;
      await subAdmin.save();
      success(res, "Status updated successfully.");
    } catch (error) {
      console.log({ error });
      serverError(res, "Internal server error");
    }
  },
};
