const AdminModels = require("../../Models/Admin");
const response = require("../../../helper/helper");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Validator } = require("node-input-validator");
const { findById } = require("../../Models/Admin");
const transporter = require("../../../config/emailConfig");
const {
  serverError,
  validateFail,
  failed,
  success,
} = require("../../../helper/helper");
const { ObjectId } = require("mongodb");

module.exports = {
  //********Admin Register*********** */
  register: async (req, res) => {
    try {
      const v = new Validator(req.body, {
        name: "required",
        email: "required",
        password: "required",
        password_confirm: "required",
        tc: "required",
      });

      const matched = await v.check();

      if (!matched) {
        return validateFail(res, v);
      }

      const { name, email, password, password_confirm, tc } = req.body;
      const existCheck = await AdminModels.findOne({ email: email });
      if (existCheck) {
        return failed(res, "User already Exists");
      }
      if (password !== password_confirm) {
        return failed(
          res,
          "Passwords do not match. Please enter the same password in both fields."
        );
      }
      const salt = await bcrypt.genSalt(10);
      const hashPassword = await bcrypt.hash(password, salt);

      const adminData = new AdminModels({
        name: name,
        email: email,
        password: hashPassword,
        tc: tc,
      });

      await adminData.save();

      return success(res, "User Successfully Registered", adminData);
    } catch (error) {
      console.error(error);
      return serverError(res, "Internal Server Error!");
    }
  },
  //********Admin login*********** */
  login: async (req, res) => {
    try {
      const v = new Validator(req.body, {
        email: "required",
        password: "required",
      });

      const matched = await v.check();

      if (!matched) {
        return validateFail(res, v);
      }

      const { email, password } = req.body;

      const existCheck = await AdminModels.findOne({ email: email });

      if (!existCheck) {
        return failed(res, "User Not Found on this email!");
      }
      const passwordCheck = await bcrypt.compare(password, existCheck.password);

      if (existCheck.email === email && passwordCheck) {
        const token = await existCheck.generateToken();
        existCheck.token = token;
        const adminId = new ObjectId(existCheck._id);
        const detail = await AdminModels.aggregate([
          { $match: { roleType: 2, _id: adminId } },
          {
            $lookup: {
              from: "permissions",
              localField: "_id",
              foreignField: "adminId",
              as: "permissions",
            },
          },
          {
            $unwind: "$permissions",
          },
          {
            $lookup: {
              from: "modules",
              localField: "permissions.moduleId",
              foreignField: "_id",
              as: "moduleDetails",
            },
          },
          {
            $unwind: "$moduleDetails",
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
              permissions: {
                $push: {
                  _id: "$permissions._id",
                  moduleId: "$permissions.moduleId",
                  name: "$moduleDetails.name",
                  slug: "$moduleDetails.slug",
                  roles: "$permissions.roles",
                },
              },
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
              permissions: 1,
            },
          },
        ]);
        // let dataAccess = [];
        // if (detail.length > 1) {
        //   let [firstInd, ...restInd] = detail;
        //   dataAccess = [
        //     firstInd,
        //     ...restInd.map(({ permissions, modules }) => ({
        //       permissions,
        //       modules,
        //     })),
        //   ];
        // } else {
        //   dataAccess = detail;
        // }
        data = {
          user: existCheck,
          detail,
        };

        return success(res, "User login successfully", data);
      } else {
        return failed(res, "Email or Password not valid!");
      }
    } catch (error) {
      console.error(error);
      return serverError(res, "Internal Server Error!");
    }
  },
  //********Admin update password*********** */
  changePassword: async (req, res) => {
    try {
      const v = new Validator(req.body, {
        old_password: "required",
        password: "required",
        password_confirm: "required",
      });

      const matched = await v.check();
      if (!matched) {
        return validateFail(res, v);
      }

      const { password, password_confirm, old_password } = req.body;

      const user = await AdminModels.findById(req.user._id);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if old_password matches the current password
      const passwordMatch = await bcrypt.compare(old_password, user.password);
      if (!passwordMatch) {
        return failed(res, "Old password is incorrect!");
      }

      if (password !== password_confirm) {
        return failed(
          res,
          "password and Confirm password do not matched,please Same password and Confirm Password"
        );
      }
      const salt = await bcrypt.genSalt(10);
      const hashPassword = await bcrypt.hash(password, salt);
      const updatedUser = await AdminModels.findByIdAndUpdate(
        req.user._id,
        { $set: { password: hashPassword } },
        { new: true } // This option returns the updated user object
      );

      if (!updatedUser) {
        return failed(res, "User not found!");
      }
      return success(res, "Password Update Successfully");
    } catch (error) {
      console.error(error);
      return serverError(res, "Internal Server Error!");
    }
  },
  //********Admin Update reset Link*********** */
  sendPasswordResetLink: async (req, res) => {
    try {
      const v = new Validator(req.body, {
        email: "required",
      });

      const matched = await v.check();
      if (!matched) {
        return validateFail(res, v);
      }

      const { email } = req.body;

      const user = await AdminModels.findOne({ email: email });
      if (!user) {
        return failed(res, "Email Does not Exists", {});
      }
      const token = await user.generateToken();
      const base_url = process.env.WEB_BASE_URL;
      const link = `${base_url}/#/reset-password/${token}`;
      // console.log('sdsd',link);

      const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM, // sender address
        to: user.email, // list of receivers
        subject: "RipenApps Reset Password", // Subject line
        text: "Hello Ripeners?", // plain text body
        html: `<a href=${link}>Click Here</a> to Reset Your Password`, // html body
      });

      return success(res, "Password Reset Email Send Successfully", token);
    } catch (error) {
      console.error(error);
      return serverError(res, "Internal Server Error!");
    }
  },
  //********Admin rest Password*********** */
  resetPassword: async (req, res) => {
    try {
      const v = new Validator(req.body, {
        password: "required",
        password_confirm: "required",
        token: "required",
      });

      const matched = await v.check();
      if (!matched) {
        return validateFail(res, v);
      }

      const { password, password_confirm, token } = req.body;

      const decodedToken = jwt.verify(token, process.env.JWT_SECRET_KEY);

      const user = await AdminModels.findById(decodedToken._id);
      console.log("userdata", user);
      if (!user) {
        return failed(res, "User Not Found");
      }
      new_token = await user.generateToken();
      if (password !== password_confirm) {
        return failed(
          res,
          "password do Not Match! Password and Confirm password please Same"
        );
      }

      const salt = await bcrypt.genSalt(10);
      const hashPassword = await bcrypt.hash(password, salt);
      const updatedUser = await AdminModels.findByIdAndUpdate(
        user._id,
        { $set: { password: hashPassword } },
        { new: true } // This option returns the updated user object
      );
      return success(res, "Password Update Successfully");
    } catch (error) {
      console.error(error);
      return serverError(res, "Internal Server Error!");
    }
  },
};
