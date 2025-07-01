let express = require("express");
let router = express.Router();
let authController = require("../../controllers/authcontroller");
let { check, oneOf} = require('express-validator');
/**
 * @typedef login
 * @property {string} userContact.required User mobile number or email address - eg: tulika@thelattice.in
 */

/**
 * Login 
 * @route POST /v1/auth/login
 * @group Authentication
 * @param {login.model} login.body.required
 * @returns {object} 201 - User data created successfully.
 * @returns {object} 200 - User data not found.
 * @returns {Error} 401 - You are unauthorized to perform this operation.
 * @returns {Error} 500 - Unable to process
 * @returns {Error} 504 - Database connection error
 */

router.post("/login", [oneOf([
    check("userContact").notEmpty().isEmail().isLength({max: 70}), check("userContact").notEmpty().isNumeric().isLength({min: 10, max: 10})
])], authController.login);

/**
* @typedef OTPAuth
* @property {string} userContact.required User mobile number or email address - eg: tulika@thelattice.in
* @property {number} otp.required 6 digits OTP received via sms or email - eg; 000000
*/

/**
* Login 
* @route POST /v1/auth/otp
* @group Authentication
* @param {OTPAuth.model} OTPAuth.body.required
* @returns {object} 201 - User data created successfully.
* @returns {object} 200 - User data not found.
* @returns {Error} 401 - You are unauthorized to perform this operation.
* @returns {Error} 500 - Unable to process
* @returns {Error} 504 - Database connection error
*/

router.post("/otp",[oneOf([
    check("userContact").notEmpty().isEmail().isLength({max: 70}), check("userContact").notEmpty().isNumeric().isLength({min: 10, max: 10})
]), check("otp").notEmpty().isNumeric().isLength({min: 6, max: 6})], authController.OTPAuthentication);


// user verification
router.post('/verification', [
    oneOf([
        check("userContact").notEmpty().isEmail().isLength({max: 70}), check("userContact").notEmpty().isNumeric().isLength({min: 10, max: 10})]),
    check('type').notEmpty().isIn(['register', 'delete']),
], authController.userVerification);

// user verification verify OTP
router.post('/verification/otp', [oneOf([
    check("userContact").notEmpty().isEmail().isLength({max: 70}), check("userContact").notEmpty().isNumeric().isLength({min: 10, max: 10})
]), check("otp").notEmpty().isNumeric().isLength({min: 6, max: 6}),
    check('type').notEmpty().isIn(['register', 'delete']),
], authController.userVerificationVerifyOTP);

module.exports = router