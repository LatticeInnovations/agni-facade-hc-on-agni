let express = require("express");
let router = express.Router();
let interventionController = require("../../controllers/interventionMasterController")

router.post("/", interventionController.saveInterventionData); 
router.put("/", interventionController.updateInterventionData); 
 
router.get("/", interventionController.getInterventionData); 
router.patch("/", interventionController.patchInterventionData); 


module.exports = router