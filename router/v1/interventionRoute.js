let express = require("express");
let router = express.Router();
const interventionMasterController = require("../../controllers/interventionMasterController")
const interventionController = require("../../controllers/interventionController")

router.post("/master", interventionMasterController.saveInterventionData); 
router.put("/master", interventionMasterController.updateInterventionData); 
 
router.get("/master", interventionMasterController.getInterventionData); 
router.patch("/master", interventionMasterController.patchInterventionData); 

router.post("/", interventionController.saveInterventionData); 
router.put("/", interventionController.updateInterventionData); 
router.get("/", interventionController.getInterventionData); 


module.exports = router