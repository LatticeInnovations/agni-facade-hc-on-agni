let express = require("express");
let router = express.Router();
let dashboardController = require("../../controllers/dashboardController");
let screeningSiteDashboardController = require("../../controllers/screeningSiteDashboardController");

router.get("/screening-site", screeningSiteDashboardController.getScreeningSiteDashboard);


router.get("/facility",  dashboardController.getFacilityDashboard);

router.get("/division", dashboardController.getDivisionDashboard); 

module.exports = router;