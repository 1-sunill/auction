const userAuth = require('./api/v1/user/userAuth'); //without auth user api
const bidder = require('./api/v1/user/bidder'); //with auth bidder api
const seller = require('./api/v1/user/seller'); //with auth seller api
const user = require('./api/v1/user/user'); //with auth seller api
const adminAuth = require('./api/v1/admin/adminAuth'); //without auth admin api
const admin = require('./api/v1/admin/admin'); //with auth admin api
const Master = require('./api/v1/master/master')
const adminMiddleware = require('../app/Middleware/adminAuth');
const pageRoute = require('./api/v1/other');
const UserAuthMiddleware = require('../app/Middleware/userAuth');
module.exports = function (app) {
    app.use('/api/v1/master', Master)
    //user route
    app.use("/api/v1/user/auth", userAuth)
    app.use("/api/v1/bidder", UserAuthMiddleware, bidder)
    app.use("/api/v1/seller", UserAuthMiddleware, seller)
    app.use("/api/v1/user", UserAuthMiddleware, user)

    //admin route
    app.use("/api/v1/admin/auth", adminAuth)
    app.use("/api/v1/admin", adminMiddleware, admin)

    app.use("/", pageRoute)
};