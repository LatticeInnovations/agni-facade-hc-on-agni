let express = require("express");
let router = express.Router();
let dxController = require("../../controllers/priorDxController")

router.post("/",  dxController.savePriorDxData);

router.get("/", dxController.getPriorDxData); 




module.exports = router