let express = require("express");
let router = express.Router();
let allergyController = require("../../../controllers/allergyController");


router.post("/",  allergyController.saveAllergyData);

router.get("/", allergyController.getAllergyData); 

module.exports = router