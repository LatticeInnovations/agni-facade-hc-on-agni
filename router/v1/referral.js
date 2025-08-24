let express = require("express");
let router = express.Router();
let referralController = require("../../controllers/referralController")


router.post("/",  referralController.saveReferralData);

router.get("/", referralController.getReferralData); 

router.get("/healthFacility", referralController.referralHospitals); 

module.exports = router