let express = require("express");
let router = express.Router();
let tobaccoController = require("../../../controllers/tobaccoController")


router.post("/",  tobaccoController.saveTobaccoData);

router.get("/", tobaccoController.getTobaccoData); 

module.exports = router