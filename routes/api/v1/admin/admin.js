const express = require("express");
const router = express.Router();
const CategoryController = require("../../../../app/Controllers/admin/CategoryController");
const SubCategoryController = require("../../../../app/Controllers/admin/SubCategoryController");
const UserController = require("../../../../app/Controllers/admin/UserController");
const ProductController = require("../../../../app/Controllers/admin/ProductController");
const FaqController = require("../../../../app/Controllers/admin/FaqController");
const CmsController = require("../../../../app/Controllers/admin/CmsController");
const NotificationController = require("../../../../app/Controllers/admin/NotificationController");
const OrderController = require("../../../../app/Controllers/admin/OrderController");
const WalletController = require("../../../../app/Controllers/admin/WalletController");
//Seller Routes
router.post("/seller/profile-complete", UserController.profileCompleted);
router.get("/seller/getSellers", UserController.getSellers);
router.get("/seller/singleDetails/:id", UserController.getsellersingleDetails);
router.post("/seller/changeStatus", UserController.statusChange);
router.post("/seller/profileUnblock", UserController.unblockSellerProfile);
router.post("/seller/edit-profile", UserController.editProfile);

//Bidder routes

router.get("/bidder/getbidders", UserController.getBidders);
router.get("/bidder/singleDetails/:id", UserController.singleDetails);
router.post("/bidder/changeStatus", UserController.statusChange);
router.post("/bidder/edit-profile", UserController.editProfile);
router.get("/bidder/orders-detail", UserController.orderDetails);
router.get("/bidder/seller-orders-detail", UserController.sellerOrderDetails);
router.get("/dashboard", UserController.dashboard);
router.get("/dashboard-list", UserController.dashboardList);

//Product Routes
router.get("/product/getProducts", ProductController.getProducts);
router.get("/product/getProduct", ProductController.getProductSingleDetails);
router.post("/product/changeStatus", ProductController.statusChange);
router.post("/product/delete", ProductController.productDeleted);

//Order Routes
router.get("/order/getOrders", OrderController.getOrders);
router.get("/order/details", OrderController.getOrderDetails);

router.post(
  "/order/return-request-accept-reject",
  OrderController.returnRequestAcceptReject
);

//Categories Routes
router.post("/Category/add", CategoryController.addCategory);
router.get("/Category/getCategories", CategoryController.getCategories);
router.get("/Category/singleDetails/:id", CategoryController.singleDetails);
router.post("/Category/edit", CategoryController.editCategory);
router.post("/Category/changeStatus", CategoryController.statusChange);
router.delete(
  "/Category/deleteCategory/:id",
  CategoryController.deleteCategory
);

//SubCategory Route
router.post("/SubCategory/add", SubCategoryController.addSubCategory);
router.get(
  "/SubCategory/getSubCategories",
  SubCategoryController.getSubCategories
);
router.get(
  "/SubCategory/singleDetails/:id",
  SubCategoryController.singleDetails
);
router.post("/SubCategory/edit", SubCategoryController.editSubCategory);
router.post("/SubCategory/changeStatus", SubCategoryController.statusChange);
// router.delete('/SubCategory/deleteSUbCategory/:id', SubCategoryController.de);

//Faq Routes
router.post("/faq/add", FaqController.addFaq);
router.get("/faq/getFaqs", FaqController.getFaq);
router.get("/faq/getFaqCategories", FaqController.getFaqCategories);
router.get("/faq/singleDetails/:id", FaqController.singleDetails);
router.post("/faq/editFaq", FaqController.editFaq);
router.post("/faq/changeStatus", FaqController.statusChange);
router.delete("/faq/deleteFaq/:id", FaqController.deleteFaq);

//CMS Routes
router.post("/cms/add", CmsController.addCms);
router.get("/cms/getCms", CmsController.getCms);
router.get("/cms/singleDetails", CmsController.singleDetails);
router.post("/cms/editCms", CmsController.editCms);
router.post("/cms/changeStatus", CmsController.statusChange);
router.delete("/cms/deleteCms/:id", CmsController.deleteCms);

//Notification Routes
router.get(
  "/notification/getBidderSellerList",
  NotificationController.getBidderSellerList
);
router.get(
  "/notification/getNotification",
  NotificationController.getAdminNotifications
);
router.delete(
  "/notification/delete/:id",
  NotificationController.deleteNotification
);

router.post(
  "/notification/sendNotification",
  NotificationController.addNotification
);

//Wallet mangement
router.get("/wallet-history", WalletController.walletHistory);

router.get("/get-commision", OrderController.getCommission);
router.post("/update-commision", OrderController.updateCommission);

module.exports = router;
