let router = require('express').Router();
let auth = require("../../../middleware/checkAuth");

router.use("/Schedule", auth, require("./scheduleRoute"))
router.use("/Appointment", auth, require("./appointmentRoute"));
router.use("/CVD", auth, require("./CVDRoute"));
// router.use("/priorDx", auth, require("./priorDxRoute"));
// router.use("/Medication", auth, require("./medicationRoute"));
// router.use("/intervention", auth, require("./interventionRoute"));
// router.use("/examination", auth, require("./examinationRoute"));
// router.use("/historyMedicine", auth, require("./medicationHistoryRoute"))
// router.use("/familyHistory", auth, require("./familyHistoryRoute"))
router.use("/allergy", auth, require("./allergyRoute"))
router.use("/Vital", auth, require("./vitalRoute"));
// router.use("/riskFactor", auth, require("./riskFactorRoute"))
// router.use("/tobaccoCessation", auth, require("./tobaccoRoute"))
// router.use("/diagnosis", auth, require("./symDiagRoute"));
// router.use("/Prescription", auth, require("./prescriptionRoute"));
// router.use("/referral", auth, require("./referral"));

router.use("/service-mode", auth, require("./serviceRoute"));

module.exports = router;