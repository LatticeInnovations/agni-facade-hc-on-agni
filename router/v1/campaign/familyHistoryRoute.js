let express = require("express");
let router = express.Router();
let familyHistoryController = require("../../../controllers/familyHistoryController");


router.post("/",  familyHistoryController.saveFamilyHistoryData);

router.get("/", familyHistoryController.getFamilyHistoryData); 

module.exports = router