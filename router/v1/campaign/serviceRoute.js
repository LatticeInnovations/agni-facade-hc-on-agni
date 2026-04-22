const express = require("express");
const router = express.Router();

const {
    saveServiceMode,
    updateServiceMode,
    getServiceModeList,
    getServiceModeDetails
} = require("../../controllers/serviceModeController");

router.post("/", saveServiceMode);
router.put("/", updateServiceMode);
router.get("/", getServiceModeList);
router.get("/:id", getServiceModeDetails);

module.exports = router;