let express = require("express");
let router = express.Router();
let riskFactorController = require("../../../controllers/riskFactorController")

router.post("/",  riskFactorController.saveRiskFactorData);

router.get("/", riskFactorController.getRiskFactorData); 




module.exports = router