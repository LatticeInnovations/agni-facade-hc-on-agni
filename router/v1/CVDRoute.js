let express = require("express");
let router = express.Router();
let cvdController = require("../../controllers/CVDController")


router.post("/",  cvdController.saveCVDData);

router.get("/", cvdController.getCVDData); 

// router.patch("/", cvdController.updateCVDData); 

module.exports = router