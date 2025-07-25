let router = require('express').Router();
let auth = require("../../middleware/checkAuth");
// router.use("/auth", require("./authentication"));
// router.use("/user", auth, require("./user"));
router.use("/sct", auth, require("./snomedCT"));
router.use("/timestamp", auth, require('./timestamp'));
router.use('/upload', auth, require('./fileUpload'));
router.use("/level",auth, require("./levelRouter"))
router.use("/vaccine", auth, require("./vaccine"));
router.use("/Practitioner", auth, require("./practitionerRoute"))
router.use("/PractitionerRole", auth, require("./practitionerRoleRoute"))
router.use("/Organization", auth, require("./organizationRoute"))
router.use("/Patient", auth, require("./patientRoute"))
router.use("/RelatedPerson", auth, require("./relatedPersonRoute"))
router.use("/Schedule", auth, require("./scheduleRoute"))
router.use("/Appointment", auth, require("./appointmentRoute"));
router.use("/Vital", auth, require("./vitalRoute"));
router.use("/SympDx", auth, require("./symDiagRoute"));
router.use("/CVD", auth, require("./CVDRoute"));
router.use("/priorDx", auth, require("./priorDxRoute"));
router.use("/Medication", auth, require("./medicationRoute"));
router.use("/Prescription", auth, require("./prescriptionRoute"));
router.use("/PrescriptionFile", auth, require("./prescriptionFileRoute"));
router.use("/MedicationDispense", auth, require("./medicationDispenseRoute"));
router.use("/DispenseLog", auth, require("./dispenseLogRoute"));
router.use("/LabReport", auth, require("./LabReportRoute"));
router.use("/MedicalRecord", auth, require("./medicalRecordRoute"));
router.use("/Immunization", auth, require("./immunizationRoute"));
router.use("/ImmunizationRecommendation", auth, require("./immunizationRecommendationRoute"));
router.use("/historyMedicine", auth, require("./medicationHistoryRoute"))

module.exports = router;