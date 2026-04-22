let express = require("express");
let router = express.Router();
let vitalController = require("../../../controllers/vitalController")


router.post("/",  vitalController.setVitalData);

router.get("/", vitalController.getVitalData); 





module.exports = router