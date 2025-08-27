let express = require("express");
let router = express.Router();
let practitionerController = require("../../controllers/practitionerController")
/**
 * @typedef resource
 * @property {Array} identifier - resource Identifier
 * @property {boolean} active  - resource is active or not
 * @property {string} firstName  - practitioner first name
 * @property {string} lastName  - practitioner last name
 * @property {string} gender  - practitioner gender
 * @property {Date} birthDate  - practitioner date of 
 * @property {object} address - home address of practitioner
 * @property {string} email - practitioner email
 * @property {string} mobileNumber - practitioner mobile number
 */

/**
 * practitioner multiple resources
 * @route POST /v1/Practitioner
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

router.post("/",  practitionerController.savePractitionerData);

router.put("/",  practitionerController.updatePractitionerData);

/**
 * @typedef resource
 * @property {Array} identifier - resource Identifier
 * @property {boolean} active  - resource is active or not
 * @property {object} firstName  - practitioner first name
 * @property {object} lastName  - practitioner last name
 * @property {object} gender  - practitioner gender
 * @property {object} birthDate  - practitioner date of 
 * @property {object} address - home address of practitioner
 * @property {object} email - practitioner email
 * @property {object} mobileNumber - practitioner mobile number
 */

/**
 * practitioner multiple resources
 * @route POST /v1/Practitioner
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

router.patch("/",  practitionerController.patchPractitionerData);

 
/**
 * Get practitioner list
 * @route GET /v1/Practitioner
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

router.get("/", practitionerController.getPractitionerData); 




module.exports = router