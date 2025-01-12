const express = require("express");
 const CategorySubCategoryController = require("../../../../app/Controllers/api/v1/user/seller/CategorySubCategoryController");
 const ProductController = require("../../../../app/Controllers/api/v1/user/seller/ProductController");
 const BidController = require("../../../../app/Controllers/api/v1/user/seller/BidController");
 const OrderController = require("../../../../app/Controllers/api/v1/user/seller/OrderController");
const { route } = require("./userAuth");

const router = express.Router();

//get Category and Subcategory Data
 router.get('/getCategoriesWithSubcategories', CategorySubCategoryController.getCategoriesWithSubcategories);

 //route for product
 router.get('/product', ProductController.getProductsWithFilter);
 router.get('/product/details', ProductController.singleProductDetails);
 router.post('/product/add', ProductController.addProduct);
 router.post('/product/edit', ProductController.editProduct);
 router.delete('/product/delete', ProductController.deleteProduct);

 //route for bid
 router.post('/bid/add', BidController.addBidding);
 router.get('/bid/highest-list', BidController.listHighestBidForProductFeatured);
 router.get('/bid/highest-detail', BidController.HighestBidForProductFeatured);
 router.get('/bid/bidding-history', BidController.biddingHistoryForProduct);

 router.get('/bid/mybids', BidController.HighestBiddingForMyProducts);

 router.get('/bid/featured-bids', BidController.FeaturedHighestBiddingForMyProducts);

 router.get('/bid/onging-featured-bids', BidController.HighestBidForAllProductFeatured);

 
 

 

 //Order Routes
 router.get('/order/getMyOrders', OrderController.getMyOrders);
 router.get('/order/getOrder', OrderController.getOrder);
 router.get("/order/sold-products", OrderController.soldProducts);

 router.post('/order/packed', OrderController.orderPacked);
 router.post('/order/assign-second-highest-bidder', OrderController.secondHighestBidder);
 router.post('/order/download-invoice', OrderController.auctionOrderPdf);
 

 
router.get("/graph-data", BidController.graphData);

 



module.exports = router;