let express = require("express");
let router = express.Router();
let examMasterController = require("../../controllers/textExamMasterController")

router.post("/master", examMasterController.saveTestExamData); 
router.put("/master", examMasterController.updateTestExamData); 
 
router.get("/master", examMasterController.getTestExamData); 
router.patch("/master", examMasterController.patchTestExamData); 


module.exports = router