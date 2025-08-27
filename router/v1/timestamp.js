let express = require("express");
let router = express.Router();
let {getTimestamp,
    updateTimestamp} = require("../../controllers/timestampController");


/**
 * Get Patients timestamps
 * @route GET /v1/timestamp
 * @security JWT
 * @returns {object} 200 - User data not found.
 * @returns {Error} 401 - You are unauthorized to perform this operation.
 * @returns {Error} 500 - Unable to process
 * @returns {Error} 504 - Database connection error
 */

router.get("/", getTimestamp);

router.post("/", updateTimestamp);

module.exports = router