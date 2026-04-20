let express = require("express");
let router = express.Router();
let appointmentController = require("../../controllers/appointmentController")


router.post("/",  appointmentController.setAppointmentData);

router.get("/", appointmentController.getAppointment); 

router.patch("/", appointmentController.patchAppointmentData); 




module.exports = router