const express = require("express");
 const ProductController = require("../../../../app/Controllers/api/v1/user/bidder/ProductController");
 const BidController = require("../../../../app/Controllers/api/v1/user/bidder/BidController");
 const ReviewRatingController = require("../../../../app/Controllers/api/v1/user/bidder/ReviewRatingController");
const OrderController = require("../../../../app/Controllers/api/v1/user/bidder/OrderController");

const router = express.Router();

//home
router.get("/home-product-list", ProductController.homeProductList);
 //route for product
 router.get('/product', ProductController.getProductsWithFilter);
 router.get('/product/details', ProductController.singleProductWithSellerDetails);
 router.get('/product/sellerProductLists', ProductController.getProductsAddedBySeller);

 //route For WishList 
 router.post('/product/addWishList', ProductController.addWishList);
 router.get('/product/getWishList', ProductController.getWishList);
 router.get('/getFavoriteSeller', ProductController.getSellerFavorites);
 
 router.get('/getBestSellers', ProductController.getBestSellers);    
 router.get('/getSeller', ProductController.singleSellerDetails);
 router.get('/featured-product', ProductController.allProductFeatured); 
 
 //route For MyBid
 router.get('/mybid/getmyBids', BidController.HighestMyBiddingForAnyProduct);
 router.get('/mybid/pending-myBids', BidController.HighestPendingBiddingForProducts);
 router.get('/mybid/bidDetails', BidController.biddingDetails);
 

 //route for Review and Rating
 router.post('/review/addUpdate', ReviewRatingController.addUpdateReviewRating);
 router.get('/review/getReviews', ReviewRatingController.getReviews);

 router.post('/order/add', OrderController.addOrder);
 router.get('/order/getMyOrders', OrderController.getMyOrders);

 router.get('/order/getOrder', OrderController.getOrder);
 router.post('/order/cancelOrder', OrderController.cancelOrder);
router.post("/order/reject-order",OrderController.rejectOrder)

module.exports = router;