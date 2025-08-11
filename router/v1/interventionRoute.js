let express = require("express");
let router = express.Router();
let interventionController = require("../../controllers/interventionMasterController")

router.post("/master", interventionController.saveInterventionData); 
router.put("/master", interventionController.updateInterventionData); 
 
router.get("/master", interventionController.getInterventionData); 
router.patch("/master", interventionController.patchInterventionData); 


module.exports = router