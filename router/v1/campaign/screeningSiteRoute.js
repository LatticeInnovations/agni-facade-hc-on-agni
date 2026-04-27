const express = require("express");
const router = express.Router();

const {
    createScreeningSite,
    updateScreeningSite,
    getScreeningSite,
    listScreeningSites,
    deleteScreeningSite
} = require("../../../controllers/screeningSiteController");

router.post("/", createScreeningSite);
router.get("/", listScreeningSites);
router.get("/:id", getScreeningSite);
router.put("/", updateScreeningSite);
router.delete("/:id", deleteScreeningSite);

module.exports = router;