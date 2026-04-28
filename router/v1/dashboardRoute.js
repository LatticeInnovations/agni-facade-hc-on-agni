let express = require("express");
let router = express.Router();
let dashboardController = require("../../controllers/dashboardController");



router.get("/screening-site", dashboardController.getScreeningSiteDashboard);

module.exports = router;