const express = require("express");
const router = express.Router();
const InformationController = require("../../../app/Controllers/api/v1/user/InformationController");
const WalletController = require("../../../app/Controllers/api/v1/WalletController");

router.get("/faq-list", InformationController.faqList);
router.post("/test-data", InformationController.testData);
router.post("/make-test", InformationController.makeTest);

router.get("/terms-condition", InformationController.terms);
router.get("/privacy-policy", InformationController.policy);
router.get("/about-us", InformationController.about);
router.get("/cancellation-policy", InformationController.cancelPolicy);
router.post("/send-notification", InformationController.sendNotifcation);
router.get("/payment/status", WalletController.status);
// router.post("/payment/callback", WalletController.paymentCallBack);

router.post("/contact-form", InformationController.submitContactForm);
module.exports = router;
