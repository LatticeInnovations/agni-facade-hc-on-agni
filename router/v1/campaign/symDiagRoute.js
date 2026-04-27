let express = require("express");
let router = express.Router();
let symDiagController = require("../../../controllers/symDiagController")


router.post("/",  symDiagController.saveSymptomDiagnosisData);

router.get("/", symDiagController.getSymptomDiagnosisData); 

module.exports = router;