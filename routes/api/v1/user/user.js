const express = require("express");

const AddressController = require("../../../../app/Controllers/api/v1/user/AddressController");
const ProfileController = require("../../../../app/Controllers/api/v1/user/ProfileController");
const SupportController = require("../../../../app/Controllers/api/v1/user/SupportController");
const WalletController = require("../../../../app/Controllers/api/v1/WalletController");
const InformationController = require("../../../../app/Controllers/api/v1/user/InformationController");

const { route } = require("./userAuth");

const router = express.Router();

router.get("/faq-list", InformationController.faqList);
router.get("/profile/getUserDetails", ProfileController.getUser);

//Change Password
router.post("/profile/changePassword", ProfileController.changePassword);
router.post("/profile/switch", ProfileController.profileSwitch);
router.post("/profile/edit", ProfileController.editProfile);
router.delete("/profile/delete", ProfileController.deleteAccount);

//route for Address
router.get("/profile/address/lists", AddressController.getAddress);
router.post("/profile/address/add/edit", AddressController.addEditAddress);
router.delete("/profile/address/delete", AddressController.deleteAddress);

//Support
router.post("/support-chat", SupportController.supportChat);
router.get("/support-chat-list", SupportController.ticketList);
router.post("/image-upload", SupportController.imageUpload);

//Wallet mangement
router.post("/add-wallet-amount", WalletController.addWalletAmount);
router.get("/wallet-history", WalletController.walletHistory);
router.post("/withdraw-amount", WalletController.withdrawAmountFromWallet);
router.post("/create-payment", WalletController.createNewPayment);
router.post("/validate-payment", WalletController.validatePayment);

router.get("/payment/success", WalletController.success);
router.get("/payment/failed", WalletController.failed);

router.post("/upload-image", WalletController.withdrawAmountFromWallet);

module.exports = router;
