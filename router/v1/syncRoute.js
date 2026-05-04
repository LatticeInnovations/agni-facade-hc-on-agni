const express = require("express");
let router = express.Router();
const  nationalIdController = require("../../controllers/nationalIdController")
const {fullSync} = require("../../services/syncService")
router.get("/", async (req, res) => {
    await fullSync();
    res.send("Manual sync done");
});


router.get("/national-id", nationalIdController.getPaginatedNationalIds);

module.exports = router