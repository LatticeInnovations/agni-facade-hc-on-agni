let express = require("express");
let router = express.Router();
let scheduleController = require("../../controllers/scheduleController")


router.post("/",  scheduleController.setScheduleData);

router.get("/", scheduleController.getScheduleData); 




module.exports = router