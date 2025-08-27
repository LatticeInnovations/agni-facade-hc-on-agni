let express = require("express");
let router = express.Router();
let medicineHistoryController = require("../../controllers/historyTakingMedicationController");


router.post("/",  medicineHistoryController.saveHistoryMedicationData);

router.get("/", medicineHistoryController.getMedicationHistoryData); 


module.exports = router