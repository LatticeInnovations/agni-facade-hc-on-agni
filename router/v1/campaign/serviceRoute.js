const express = require("express");
const router = express.Router();

const {
    saveServiceMode,
    updateServiceMode
} = require("../../../controllers/serviceModeController");

router.post("/", saveServiceMode);
router.put("/", updateServiceMode);

module.exports = router;