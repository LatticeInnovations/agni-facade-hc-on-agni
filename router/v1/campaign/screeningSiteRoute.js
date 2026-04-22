const express = require("express");
const router = express.Router();

const {
    createScreeningSite
} = require("../../../controllers/screeningSiteController");

router.post("/", createScreeningSite);

module.exports = router;