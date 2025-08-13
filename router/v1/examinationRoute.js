let express = require("express");
let router = express.Router();
let examMasterController = require("../../controllers/textExamMasterController")
let examController = require("../../controllers/examinationController")
router.post("/master", examMasterController.saveTestExamData); 
router.put("/master", examMasterController.updateTestExamData); 
 
router.get("/master", examMasterController.getTestExamData); 
router.patch("/master", examMasterController.patchTestExamData); 

router.post("/", examController.saveExaminationData); 
router.get("/", examController.getExaminationData); 


module.exports = router