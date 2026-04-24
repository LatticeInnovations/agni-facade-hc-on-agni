let express = require("express");
let router = express.Router();
const interventionController = require("../../../controllers/interventionController")


router.post("/", interventionController.saveInterventionData); 
router.put("/", interventionController.updateInterventionData); 
router.get("/", interventionController.getInterventionData); 


module.exports = router