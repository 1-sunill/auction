const express = require("express");
const router = express.Router();
const adminAuthController = require("../../../../app/Controllers/admin/AuthController");
const SubAdminController = require("../../../../app/Controllers/admin/SubadminController");
const SupportController = require("../../../../app/Controllers/admin/SupportController");
const ApiSupportController = require("../../../../app/Controllers/api/v1/user/SupportController");
const BidController = require("../../../../app/Controllers/admin/BidController");
const adminAuth = require("../../../../app/Middleware/adminAuth");

router.post("/register", adminAuthController.register);
router.post("/login", adminAuthController.login);
router.post("/changePassword", adminAuth, adminAuthController.changePassword);
router.post(
  "/send-password-reset-email",
  adminAuthController.sendPasswordResetLink
);
router.post("/reset-password", adminAuthController.resetPassword);

router.get("/module-list", SubAdminController.moduleList);
router.post("/access-modules", SubAdminController.addSubadmin);
router.get("/subadmin-list", SubAdminController.subadminList);
router.get("/subadmin-detail", SubAdminController.subAdminDetails);
router.post("/subadmin-update", SubAdminController.updateSubadmin);
router.post("/subadmin-status", SubAdminController.subadminStatus);

router.get("/support-chat-list", SupportController.ticketList);
router.get("/ticket-detail", SupportController.ticketDetail);

router.post("/support-status", SupportController.ticketStatus);

router.get("/bidder-history-list", adminAuth, BidController.bidList);
router.get("/bid-detail", adminAuth, BidController.bidDetails);
router.post("/image-upload",SupportController.imageUpload);

module.exports = router;
