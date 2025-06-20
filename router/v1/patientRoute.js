let express = require("express");
let router = express.Router();
let patientController = require("../../controllers/patientController")
/**
 * @typedef resource
 * @property {Array} identfier - resource Identifier
 * @property {boolean} active  - resource is active or not
 */

/**
 * Patient multiple resources
 * @route POST /v1/sync/{resourceType}
 * @group Bundle
 * @security JWT
 * @param {Array.<resource>} resourceList.body.required
 * @param {string} resourceType.path.required
 * @returns {object} 201 - User data created successfully.
 * @returns {object} 200 - User data not found.
 * @returns {Error} 401 - You are unauthorized to perform this operation.
 * @returns {Error} 500 - Unable to process
 * @returns {Error} 504 - Database connection error
 */

router.post("/",  patientController.savePatientData);


/**
 * Patient multiple resources
 * @route PUT /v1/sync/{resourceType}
 * @group Bundle
 * @security JWT
 * @param {Array.<resource>} resourceList.body.required
 * @param {string} resourceType.path.required
 * @returns {object} 201 - User data created successfully.
 * @returns {object} 200 - User data not found.
 * @returns {Error} 401 - You are unauthorized to perform this operation.
 * @returns {Error} 500 - Unable to process
 * @returns {Error} 504 - Database connection error
 */

router.put("/",  patientController.updatePatientData);


/**
 * Patch a resource values
 * @route PATCH /v1/sync/{resourceType}
 * @group Bundle
 * @security JWT
 * @param {Array.<resource>} resource.body.required
 * @param {string} id.path.required - resource Id to be updated
 * @param {string} resourceType.path.required
 * @returns {object} 201 - User data created successfully.
 * @returns {object} 200 - User data not found.
 * @returns {Error} 401 - You are unauthorized to perform this operation.
 * @returns {Error} 500 - Unable to process
 * @returns {Error} 504 - Database connection error
 */

router.patch("/", patientController.patchPatientData);


 
/**
 * Get patient list
 * @route GET /v1/Patient
 * @group resource
 * @security JWT
 * @param {object} params.query - resource Id to get data
 * @param {string} id.path
 * @returns {object} 200 - resource data fetched successfully.
 * @returns {object} 200 - resource data not found.
 * @returns {Error} 401 - You are unauthorized to perform this operation.
 * @returns {Error} 500 - Unable to process
 * @returns {Error} 504 - Database connection error
 */

router.get("/", patientController.getPatientData); 




module.exports = router