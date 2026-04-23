const express = require("express");
const router = express.Router();

const {
    createScreeningSite,
    getScreeningSite,
    listScreeningSites
} = require("../../../controllers/screeningSiteController");

router.post("/", createScreeningSite);
router.get("/", listScreeningSites);
router.get("/:id", getScreeningSite);

module.exports = router;