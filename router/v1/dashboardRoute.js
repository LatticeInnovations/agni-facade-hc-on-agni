let express = require("express");
let router = express.Router();
let dashboardController = require("../../controllers/dashboardController");


router.get("/facility",  dashboardController.getFacilityDashboard);

router.get("/division", dashboardController.getDivisionDashboard); 

module.exports = router;