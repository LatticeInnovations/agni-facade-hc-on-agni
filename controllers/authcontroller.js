let response = require("../utils/responseStatus");
const db = require('../models/index');
let sendSms = require('../utils/twilio.util');
let emailContent = require("../utils/emailContent");
let util = require('util');
let sendEmail = require("../utils/sendgrid.util").sendEmail
let jwt = require("jsonwebtoken");
const config = require("../config/nodeConfig");
let { validationResult } = require('express-validator');
const crypto = require('crypto');
let { client } = require('../services/redisConnect');
const { fetchResource, handleError } = require("../services/helperFunctions");
 
// login by using email or mobile number to send OTP
let login = async function (req, res) {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return response.sendInvalidDataError(res, errors);
        }
        let isEmail = checkIsEmail(req.body.userContact);
        let contact = isEmail ? 'email' : 'phone';
        let userDetail = await getUserDetail(req, contact);
        let loginAttempts = 0, otp = 0;
        let OTPGenerateAttempt = 1;
        if (userDetail == null){
            return res.status(401).json({ status: 0, message: "User does not exist" });
        }
        else if(!userDetail.dataValues.is_active){
            return res.status(401).json({ status: 0, message: "we received a delete request for your account, you can signup again after deletion" });
        }
            
        let authentication_detail = userDetail.dataValues.authentication_detail;
        let timeData = await calculateTime(authentication_detail);
        // if user comes back after >= 5 mins reset every value 
        if (timeData.lastAttemptTimeDiff > config.lockTimeInMin) {
            loginAttempts = 0;
            OTPGenerateAttempt = 1;
        }
        // if otp validation falied attempt (login attempts) >= 5 and <= 5min or otp generations >= 5 and time elapsed <= 5 mins give error
        else if (authentication_detail != null && timeData.lastAttemptTimeDiff <= config.lockTimeInMin && (authentication_detail.dataValues.login_attempts >= config.totalLoginAttempts || authentication_detail.dataValues.otp_generate_attempt >= config.OTPGenAttempt)) {
            let e = { status: 0, message: "Too many attempts. Please try after 5 mins" }
            return res.status(401).json(e)
        }
        // else increment otp generation counter ans set lock time if it is last attempt
        else if (authentication_detail != null) {
            loginAttempts = authentication_detail.dataValues.login_attempts;
            OTPGenerateAttempt = authentication_detail.dataValues.otp_generate_attempt + 1;
        }

        if (process.env.bypassNumbers.includes(req.body.userContact)) {
            otp = process.env.bypassOTP;
        } else if (process.env.playstoreNumber.includes(req.body.userContact)) {
            otp = process.env.playstoreOTP;
            OTPGenerateAttempt = 1;
            loginAttempts = 0;
        }
        else {
            otp = generateOTP();
            console.log("check if otp is generated before sending")
            try {
                await sendOTP(isEmail, userDetail, otp);
            }
            catch (e) {
                return handleError(res, null)
            }
        }

        await upsertOTP(otp, userDetail.dataValues, timeData.currentTime, timeData.expireTime, loginAttempts, OTPGenerateAttempt);
        res.status(200).json({ status: 1, "message": "Authorized user" });
    }
    catch (e) {
        console.error("login Error:" , e);
        return handleError(res, e)
 
    }

}

// authenticate OTP
let OTPAuthentication = async function (req, res) {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return response.sendInvalidDataError(res, errors);
        }
        let isEmail = checkIsEmail(req.body.userContact);
        let contact = isEmail ? 'email' : 'phone';
        let userDetail = await getUserDetail(req, contact);
        if (userDetail == null){
            return res.status(401).json({ status: 0, message: "User does not exist" });
        }
        else if(!userDetail.dataValues.is_active){
            return res.status(401).json({ status: 0, message: "we received a delete request for your account, you can signup again after deletion" });
        }
        let loginAttempts = 0, apiStatus = 200;
        let resMessage = {};
        let authentication_detail = userDetail.dataValues.authentication_detail;
        let timeData = await calculateTime(authentication_detail);
        console.log(timeData)
        if (userDetail != null && userDetail.dataValues.authentication_detail.dataValues.otp == null) {
            console.log("check here")
            return res.status(401).json({ status: 0, message: "OTP expired" });
        }
        else if (timeData.lastAttemptTimeDiff <= config.lockTimeInMin && (authentication_detail.dataValues.login_attempts >= config.totalLoginAttempts || authentication_detail.dataValues.otp_generate_attempt >= config.OTPGenAttempt)) {
            return res.status(401).json({ status: 0, message: "Too many attempts. Please try after 5 mins" })
        }
        // if user comes back after >= 5 mins reset values
        if (timeData.lastAttemptTimeDiff > config.lockTimeInMin) {
            loginAttempts = authentication_detail.dataValues.login_attempts = 0;
            authentication_detail.dataValues.otp_generate_attempt = 0;
        }

        // bypass for testing purpose
        if ((req.body.userContact == 9876543210 || req.body.userContact == "dev2@gmail.com") && req.body.otp != 222222) {
            loginAttempts = 1;
            resMessage = { status: 0, message: "Invalid OTP" };
        }
        // if otp is invalid
        else if (req.body.otp != authentication_detail.dataValues.otp) {
            apiStatus = 401;
            loginAttempts = authentication_detail.dataValues.login_attempts + 1;
            let e = loginAttempts >= config.totalLoginAttempts ? "Too many attempts. Please try after 5 mins" : `Invalid OTP`;
            resMessage = { status: 0, message: e };
            await upsertOTP(authentication_detail.dataValues.otp, userDetail.dataValues, timeData.currentTime, authentication_detail.dataValues.expire_time, loginAttempts, authentication_detail.dataValues.otp_generate_attempt);
        }
        else {
            // if otp is valid check espire time of otp  
            if (timeData.expireTimeDiffOTP <= 0) {
                return res.status(401).json({ status: 0, message: `OTP expired` });
            }
            let userProfile = {
                "userId": userDetail.dataValues.user_id, "userName": userDetail.dataValues.user_name,
                "orgId": userDetail.dataValues.org_id
            }
            let token = jwt.sign(userProfile, config.jwtSecretKey, { expiresIn: '5d' });
            upsertOTP(null, userDetail.dataValues, timeData.currentTime, null, 0, authentication_detail.dataValues.otp_generate_attempt);
            resMessage = { status: 1, message: "Logged in successfully", data: { "token": `Bearer ${token}` } }
        }
        return res.status(apiStatus).json(resMessage);
    } catch (e) {
        console.error(e);
        return res.status(500).json({
            status: 0,
            message: "Unable to process. Please try again.",
            error: e
        })
    }
}

async function calculateTime(authentication_detail) {
    let currentTime = new Date();
    let expireTime = new Date(currentTime);
    expireTime = expireTime.setMinutes(expireTime.getMinutes() + config.OTPExpireMin);
    let expireTimeDiffOTP = authentication_detail != null ? await checkAuthAttempts(authentication_detail.dataValues.expire_time, currentTime) : 0;
    let lastAttemptTimeDiff = authentication_detail != null ? await checkAuthAttempts(currentTime, authentication_detail.dataValues.createdOn) : 0;
    let data = { currentTime, expireTime, expireTimeDiffOTP, lastAttemptTimeDiff };
    return data;
}

async function sendOTP(isEmail, userDetail, otp) {
    try {
        if (isEmail) {
            let mailData = {
                to: [{ email: userDetail.dataValues.user_email }],
                subject: util.format(`${(emailContent.find(e => e.notification_type_id == 1).subject)}`,),
                content: util.format(`${(emailContent.find(e => e.notification_type_id == 1).content)}`, userDetail.dataValues.user_name, otp.toString())
            }
            console.info("check mail data")
            await sendEmail(mailData);
        }
        else {
            let text = `<#> Use OTP ${otp} for authentication in agni App\n` + config.OTPHash;
            console.log("check text message", text);
            await sendSms(userDetail.dataValues.mobile_number, text);
        }
    }
    catch (e) {
        console.error(" check if message is sent1111", e);
        return Promise.reject(e);
    }

}
// get user and his/her OTP details using sequelize
async function getUserDetail(req, contact) {
    try {
        let queryParam ={"_total": "accurate", "_revinclude": "PractitionerRole:practitioner", "active" : true};
        queryParam[contact] = contact == "email" ? req.body.userContact.toLowerCase() : req.body.userContact;
        let existingPractitioner = await fetchResource("Practitioner", queryParam);
        if (existingPractitioner.total == 0 || !existingPractitioner?.entry) {
            return null;
        }
        else {
            let user_id = existingPractitioner.entry[0].resource.id;
            let user_name = existingPractitioner.entry[0].resource.name[0].given.join(' ');
            // user_name += " " + existingPractitioner?.data?.entry?.[0]?.resource?.name?.[0]?.family || '';
            let email = existingPractitioner.entry[0].resource.telecom.filter(e => e.system == "email");
            let phone = existingPractitioner.entry[0].resource.telecom.filter(e => e.system == "phone");
            let orgId = existingPractitioner.entry[1].resource.organization.reference.split('/')[1];
            let userDetail = {}; userDetail.dataValues = {
                "user_name": user_name,
                "user_email" : email[0].value,
                "mobile_number" : phone[0].value,
                "is_active":  existingPractitioner.entry[0].resource.active,
                "user_id": user_id,
                "org_id": orgId
            }
            let userData = await db.authentication_detail.findOne({
                attributes:['auth_id', 'user_id', 'otp', 'expire_time', 'createdOn', 'login_attempts', 'otp_generate_attempt'],
                where: { "user_id": user_id }
            });
            userDetail.dataValues.authentication_detail = userData;
            return userDetail;
        }

    }
    catch (e) {
        return Promise.reject(e);
    }
}

/// check if provided contact is an email or not
function checkIsEmail(userContact) {
    const regexExp = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/gi;
    let isEmail = regexExp.test(userContact);
    return isEmail;
}

// generate 6 digits OTP
function generateOTP() {
    try {
        let minm = 100000;
        let maxm = 999999;
        let value =  crypto.randomInt(minm, maxm);
        let otp = value.toString().padStart(6, "1");
        return otp;
    }
    catch(e) {
        Promise.reject(e);
    }

}

// insert if not present or update generated OTP for the user id
async function upsertOTP(otp, userDetail, currentTime, expireTime, loginAttempts, OTPGenerateAttempt) {
    try {
        let upsertJson = { "user_id": userDetail.user_id, "otp": otp, "expire_time": expireTime, "login_attempts": loginAttempts, "createdOn": currentTime, "otp_generate_attempt": OTPGenerateAttempt };
        console.log(upsertJson)
        let upsertDetail = await db.authentication_detail.upsert(upsertJson, { conflictFields: ["user_id"] });
        return upsertDetail;
    }
    catch (e) {
        return Promise.reject(e);
    }


}

const userVerification = async (req, res, next) => {
    try{
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return response.sendInvalidDataError(res, errors);
        }
        let isEmail = checkIsEmail(req.body.userContact);
        let type = req.body.type;
        let contact = isEmail ? 'email' : 'phone';
        let userDetail = await getUserDetail(req, contact);
        console.info(userDetail)
        let user_id = userDetail?.dataValues?.user_id || null;
        
        if (userDetail != null && type == 'register'){
            return res.status(401).json({ status: 0, message: "User already exists" });
        }
        else if(!userDetail && type == 'delete'){
            return res.status(401).json({ status: 0, message: "User does not exist" });
        }
        userDetail = {
            dataValues: {
                user_name: type == "delete" ? userDetail?.dataValues?.user_name || null : req.body.userContact,
                user_email: type == "delete" ? userDetail?.dataValues?.user_email || null :  req.body.userContact,
                mobile_number: type == "delete" ? userDetail?.dataValues?.mobile_number || null : req.body.userContact,
            }
        }

        let id = type == "delete" ? user_id : req.body.userContact;
        console.info("id : ", id);
        let userdata = await client.hGetAll(id);
        console.info("user data", userdata);
        if(Object.keys(userdata).length != 0){
            let lastLoginAttempt = userdata.loginTime;
            let curLoginAttempt = new Date().valueOf();
            console.info("lastLoginAttempt: " , lastLoginAttempt);
            if(((curLoginAttempt - lastLoginAttempt) / 60 / 1000) > config.lockTimeInMin){
                await client.hSet(id, {
                    loginTime : new Date().valueOf(),
                    loginCount : 0,
                    otp: userdata.otp,
                    otpVerifyCount: 0,
                    otpTime: new Date().valueOf(),
                    otpExpTime : userdata.otpExpTime
                });
            }
            userdata = await client.hGetAll(id);
            if ((userdata.loginCount >= config.totalLoginAttempts) || userdata.otpVerifyCount >= 5) {
                console.log("Login count reset");
                return res.status(401).json({ status: 0, message: "Too many attempts. Please try after 5 mins" });
            }
        }
        let otp = generateOTP();
        console.info("OTP is : ", otp)
        if(type == "delete"){
            if(userDetail.dataValues.user_email){
                await sendOTP(true, userDetail, otp);
            }
            if(userDetail.dataValues.mobile_number){
                await sendOTP(false, userDetail, otp);
            }
        }
        else{
            await sendOTP(isEmail, userDetail, otp);
        }
        
        await client.hSet(id, {
            loginTime : Object.keys(userdata).length != 0 ? userdata.loginTime : new Date().valueOf(),
            loginCount : Object.keys(userdata).length != 0 ? Number(userdata.loginCount) + 1 : 1,
            otp,
            otpVerifyCount: 0,
            otpTime: new Date().valueOf(),
            otpExpTime : new Date(Date.now() + (2 * 60 * 1000)).valueOf()
        });
        await client.expire(id, 10*60);
        res.json({ status: 1, message: `OTP sent to ${req.body.userContact}`});
    }
    catch(e){
        console.error("userVerification Error:" , e);
        return handleError(res, e)
    }
}

const userVerificationVerifyOTP = async (req, res) => {
    try{
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return response.sendInvalidDataError(res, errors);
        }
        let isEmail = checkIsEmail(req.body.userContact);
        let contact = isEmail ? 'email' : 'phone';
        let userDetail = await getUserDetail(req, contact);
        let user_id = userDetail?.dataValues?.user_id || null;
        let type = req.body.type;
        
        if (userDetail != null && type == 'register'){
            return res.status(401).json({ status: 0, message: "User already exists" });
        }
        else if(!userDetail && type == 'delete'){
            return res.status(401).json({ status: 0, message: "User does not exist" });
        }
        let id = type == "delete" ? user_id : req.body.userContact;
        let userdata = await client.hGetAll(id);
        console.info(userdata);
        if (Object.keys(userdata).length == 0){
            return res.status(401).json({ status: 0, message: "Unauthorized user" });
        }

        let lastOTPAttempt = userdata.otpTime;
        let curLoginAttempt = new Date().valueOf();
        if (((curLoginAttempt - lastOTPAttempt) / 60 / 1000) > config.lockTimeInMin) {
            console.log("otp and login count reset");
            await client.hSet(id, {
                loginTime : userdata.loginTime,
                loginCount : userdata.loginCount,
                otp: userdata.otp,
                otpVerifyCount: 0,
                otpTime: new Date().valueOf(),
                otpExpTime : userdata.otpExpTime
            });
        }
        else if (userdata.otpVerifyCount >= 5) {
            console.log("To many incorrect otp attempts");
            return res.status(401).json({ status: 0, message: "Too many attempts. Please try after 5 mins"});
        }
        userdata = await client.hGetAll(id);
        if (userdata.otp != req.body.otp) {
            await client.hSet(id, {
                loginTime : userdata.loginTime,
                loginCount : userdata.loginCount,
                otp: userdata.otp,
                otpVerifyCount: Number(userdata.otpVerifyCount) + 1,
                otpTime: new Date().valueOf(),
                otpExpTime: userdata.otpExpTime
            });
            return res.status(401).json({ status: 0, message: 'Incorrect OTP' });
        }
        
        let otpExpTime = userdata.otpExpTime;
        let curTime = new Date().valueOf();
        if (otpExpTime < curTime) {
            await client.hSet(id, {
                loginTime : userdata.loginTime,
                loginCount : userdata.loginCount,
                otp: userdata.otp,
                otpVerifyCount: Number(userdata.otpVerifyCount) + 1,
                otpTime: new Date().valueOf(),
                otpExpTime: userdata.otpExpTime
            });
            return res.status(401).json({ status: 0, message: "OTP expired" });
        }
        let userProfile = {
            "userId": userDetail?.dataValues?.user_id || req.body.userContact, 
            "userName": userDetail?.dataValues?.user_name || req.body.userContact,
            "orgId": userDetail?.dataValues?.org_id || req.body.userContact,
            type: type,
            "email": userDetail?.dataValues?.user_email || null,
            "mobile": userDetail?.dataValues?.mobile_number || null
        }
        let token = jwt.sign(userProfile, config.jwtSecretKey, { expiresIn: '5m' });
        client.del(id);
        return res.status(200).json({ status: 1, message: "User Verified", data: { token: 'Bearer ' + token } });
    }
    catch(e){
        console.error("userVerificationVerifyOTP Error:" , e);
        return handleError(res, e)
    }
}

// check if the number of attempts is 5 and 5 mins have not lapsed, then give an error
async function checkAuthAttempts(expire_time, currentTime) {
    let exp_date = new Date(expire_time);
    let diff = (exp_date - currentTime);
    let diffMinutes = (diff / 1000) / 60;
    return diffMinutes;
}

module.exports = {
    login, OTPAuthentication, userVerification, userVerificationVerifyOTP
}