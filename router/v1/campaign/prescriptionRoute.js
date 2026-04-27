let express = require("express");
let router = express.Router();
let prescriptionController = require("../../../controllers/prescriptionController")


router.post("/",  prescriptionController.savePrescriptionData);
router.put("/",  prescriptionController.updateExistingPrescription);

router.get("/", prescriptionController.getPrescriptionData); 

module.exports = router