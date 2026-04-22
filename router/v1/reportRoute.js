let express = require("express");
let router = express.Router();
let reportController = require("../../controllers/reportController")

router.get("/access/:token", reportController.getAccessPage);

router.post(
  "/verify",
  express.urlencoded({ extended: true }),
  reportController.verifyDob
);

router.get("/download/:token", reportController.downloadReport);

module.exports = router