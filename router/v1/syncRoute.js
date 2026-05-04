const express = require("express");
const zlib = require("zlib");
const { fullSync, getData } = require("../../services/syncService");
const fs = require("fs");
let router = express.Router();
const { FILE_PATH } = require("../../services/syncService");

router.get("/", async (req, res) => {
    await fullSync();
    res.send("Manual sync done");
});


router.get("/national-id", (req, res) => {
    if (!fs.existsSync(FILE_PATH)) {
        return res.status(404).send("No data yet");
    }

    const file = fs.readFileSync(FILE_PATH);

    zlib.gzip(file, (err, zipped) => {
        res.set("Content-Encoding", "gzip");
        res.set("Content-Type", "application/json");
        res.send(zipped);
    });
});

module.exports = router