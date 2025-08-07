let express = require("express");
let router = express.Router();
let medicationController = require("../../controllers/medicationController")

router.post("/", medicationController.saveMedicationData); 
router.put("/", medicationController.updateMedicationData); 
 
router.get("/", medicationController.getMedicationList); 


module.exports = router