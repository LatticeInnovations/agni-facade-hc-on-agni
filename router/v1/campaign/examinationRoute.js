let express = require("express");
let router = express.Router();
let examController = require("../../../controllers/examinationController")

router.post("/", examController.saveExaminationData); 
router.put("/", examController.updateExaminationData); 
router.get("/", examController.getExaminationData); 


module.exports = router