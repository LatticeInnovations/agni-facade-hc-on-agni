const express = require("express");
const router = express.Router();

const {
    createScreeningSite,
    updateScreeningSite,
    getScreeningSite,
    listScreeningSites
} = require("../../../controllers/screeningSiteController");

router.post("/", createScreeningSite);
router.get("/", listScreeningSites);
router.get("/:id", getScreeningSite);
router.put("/", updateScreeningSite);

module.exports = router;