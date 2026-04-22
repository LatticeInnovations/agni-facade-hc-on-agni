let express = require("express");
let router = express.Router();
let reportTokenController = require("../../controllers/reportTokenController")

router.get("/", reportTokenController.getReportToken);

module.exports = router