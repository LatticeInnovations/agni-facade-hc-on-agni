const {validateRequest, buildAndPost, getTransformedResult, handleError, fetchResource} = require("../services/helperFunctions");
let PractitionerRole = require("../class/practitionerRole");
let Organization = require("../class/Organization");
let Practitioner = require("../class/practitioner");
let Location = require("../class/location");
const config = require("../config/nodeConfig");
let jwt = require("jsonwebtoken");
let secretKey = require('../config/nodeConfig').jwtSecretKey;
const db = require('../models/index');
let sendEmail = require("../utils/sendgrid.util").sendEmail;
let sendSms = require('../utils/twilio.util');

// Get user profile
let getUserProfile = async function (req, res) {
    try {
        let resourceType = "PractitionerRole";
        req.params.resourceType = resourceType;
        req.query = {practitionerId: req.decoded.userId};
        let queryParams = {
                "practitioner" : req.decoded.userId,
                "_include": "*",
                "_total": "accurate"
        }
        const token = req.accessToken;
        let responseData = await fetchResource(resourceType, queryParams, token)
        let practitionerData = {};
        if( !responseData.entry || responseData.total == 0) {
            return res.status(200).json({ status: 1, message: "Profile detail fetched", total: 0, data: responseData})
        }
        else {
            practitionerData = getPractitioner(responseData)
            console.log(practitionerData)
            practitionerData.userName = practitionerData.firstName + " " + (practitionerData.middleName? practitionerData.middleName + " " : "") + (practitionerData?.lastName || '');
            console.info(practitionerData)
            res.status(200).json({ status: 1, message: "Profile detail fetched", total: 1, data: practitionerData  })
        }
    }
    catch (e) {
        console.error(e);
        if (e.code && e.code == "ERR") {
            let statusCode = e.statusCode ? e.statusCode : 500;
            return res.status(statusCode).json({
                status: 0,
                message: e.message
            })
        }
        return res.status(500).json({
            status: 0,
            message: "Unable to process. Please try again.",
            error: e
        })
    }

}

function getPractitioner(responseData) {
    try {
            let practitioner = responseData.entry.find(e => e.resource.resourceType == "Practitioner");
            let practitionerData = getTransformedResult(Practitioner, practitioner.resource)
            console.log("practitionerData: ", practitionerData)
            let role = getPractitionerRole(responseData)
            console.log("role check:", role)
            const data = {
                "userId": practitionerData.fhirId,
                "firstName": practitionerData.firstName,
                "middleName": practitionerData.middleName,
                "lastName": practitionerData.lastName,
                "mobileNumber" : practitionerData.mobileNumber,
                "userEmail": practitionerData.email,
                "address": practitionerData.address,
                "role": role
            }
            return data;
    }
    catch(e) {
        console.error("addPractitioner error: ", e)
        throw e;
    }
}

function getPractitionerRole(responseData) {
    try {
        let role = [];
        let roleArray = responseData.entry.filter(e => e.resource.resourceType == "PractitionerRole");
        for (let i = 0; i < roleArray.length; i++) {                        
                let roleObj = getTransformedResult(PractitionerRole, roleArray[i].resource)
                
                let orgResource = responseData.entry.find(e => e.resource.resourceType == "Organization" && e.fullUrl.includes(roleArray[i].resource.organization.reference));
                let orgData = getTransformedResult(Organization, orgResource.resource)
                console.log("orgData: ", orgData)
                roleObj.orgId = orgData.orgId;
                roleObj.orgName = orgData.orgName,
                roleObj.orgType = orgData.orgType;
                console.log("roleObj: ", roleObj)
                role.push(roleObj);
            }
            return role;
    }
    catch(e) {
        console.error("addPractitionerRole error: ", e)
        throw e;
    }
}



const deleteUserData = async (req, res) => {
    try{
        let {tempToken} = req.headers;
        let result = await verifyToken(tempToken)
        const {type , userId, mobile, email, errorMessage } = result
        if(errorMessage){
            return res.status(422).json({ status: 0, message: errorMessage });
        }
        else if((type != "delete") || (req.decoded.userId != userId)){
            return res.status(422).json({ status: 0, message: "Invalid token" });
        }
        const deActivateRes = await deactivateUserAccount(userId)
        console.log("deActivateRes: ", deActivateRes)
        const message = 'Your account has been successfully deleted.'            
        if (email) {
            let mailData = {
                to: [{ email: email }],
                    subject: 'Agni : Account Deleted',
                    content: message
            }
            await sendEmail(mailData);
        }            
        if(mobile) {
            await sendSms(mobile, message);
        }
        return res.json({ status : 1, message: "Your account will be delete within 48 hours, you will get confirmation SMS or email"});
    }
    catch(e){
        console.info(e)
        return res.status(500).json({
            status: 0,
            message: "Unable to process. Please try again.",
            error: e
        });
    }
}

const deactivateUserAccount = async function(userId) {
    try {
        const patchBody = [
            {
                'op': 'replace',
                'path': "active",
                'value': false
            }
        ]

        const response = await axios.patch(config.baseUrl+'Practitioner/'+userId, patchBody, {
            headers: {
                 'Content-Type': 'application/json-patch+json'
            }
        });

        console.log('Practitioner deactivated successfully:', response.data);
        return response;
    }
    catch(e) {
        console.error("deactivateUserAccount error: ", e);
        throw e;
    }
}
const verifyToken = async function(tempToken) {
    try {
        let type , userId, mobile, email = null;
        let errorMessage = '';
        tempToken = tempToken?.split(" ")[1] || null;
        if (tempToken) {
            jwt.verify(tempToken, secretKey, (err, decoded) => {
                if (err) {
                    errorMessage = err.name === 'TokenExpiredError' ? 'Session expired.' : 'Unauthorized';            
                } 
                else {
                    type = decoded?.type;
                    userId =  decoded?.userId;
                    mobile = decoded?.mobile;
                    email = decoded?.email;
                }
            });
        } 
        else { 
            errorMessage = 'No token provided'
        }

        return {type , userId, mobile, email,errorMessage };
    }
    catch(e) {
        console.error("verify Token error: ", e);
        throw e
    }
}

const createUser = async (req, res) => {
    try{
        const validation = validateRequest(req, res);
        if (!validation.isValid) return;
        const { type } = req.token;
        // if(type != "register"){
        //     return res.status(401).json({ status: 0, message: "Invalid Token" });
        // }
        
        const { firstName, lastName, mobile, email, clinicName } = req.body;
        const orgObj = { contactNumber: mobile, email: email, orgName: clinicName, orgType: "prov" }
        const orgId = await buildAndPost(Organization, orgObj, "Organization");
        const userId = await buildAndPost(Practitioner, { firstName, lastName, mobile, email, clinicName }, "Practitioner")
        const practitionerRoleResponse = await buildAndPost(PractitionerRole, {orgId, userId, roleId: "doctor"}, "PractitionerRole")
        const locationResponse = await buildAndPost(Location, {clinicName, position: { "longitude": 28.537, "latitude": 77.383 }, orgId,}, "Location")
        console.log("practitionerRoleResponse: ", practitionerRoleResponse, " and locationResponse: ", locationResponse)
        
        await db.authentication_detail.create({ user_id: userId });
        const userProfile = {
            "userId": userId, 
            "userName": firstName + ' ' + lastName,
            "orgId": orgId
        }
        let token = jwt.sign(userProfile, config.jwtSecretKey, { expiresIn: '5d' });
        res.json({ status : 1, message : "Registration successful", data: { token : 'Bearer ' + token } });
    }
    catch(error){
        console.info(error)
        handleError(res, error)
    }
}



module.exports = {
    getUserProfile,
    deleteUserData,
    createUser
}