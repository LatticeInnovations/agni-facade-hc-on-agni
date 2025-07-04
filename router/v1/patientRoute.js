let express = require("express");
let router = express.Router();
let patientController = require("../../controllers/patientController")


router.post("/",  patientController.savePatientData);

router.put("/",  patientController.updatePatientData);




router.patch("/", patientController.patchPatientData);




router.get("/", patientController.getPatientData); 




module.exports = router