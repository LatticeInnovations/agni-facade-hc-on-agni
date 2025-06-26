let Practitioner = require("../class/practitioner");
let PractitionerRole = require("../class/practitionerRole");
let Organization = require("../class/Organization");
let config = require("../config/nodeConfig");
const bundleStructure = require("../services/bundleOperation")



//  Get Practitioner data
let getPractitionerRoleData = async function (req, res) {
    try {
        let role = [];
        const link = config.baseUrl + "PractitionerRole"
        let queryParams = {
            "practitioner" : req.query.practitionerId,
            "_include": "*",
            "_total": "accurate"
        }
        let resourceResult = [];
        let responseData = await bundleStructure.searchData(link, queryParams);
        let resStatus = 1;
        if( !responseData.data.entry || responseData.data.total == 0) {
                return res.status(200).json({ status: resStatus, message: "Data fetched", total: 0, data: []  })
        }
        else { 
            const FHIRData =  responseData.data.entry;      
            let practitioner = FHIRData.find(e => e.resource.resourceType == "Practitioner");
            let practitionerData = new Practitioner({}, practitioner.resource);
            practitionerData.getFHIRToTransformedResult();
            practitionerData = practitionerData.getPersonResource();
            let roleArray = FHIRData.filter(e => e.resource.resourceType == "PractitionerRole");
            for (let i = 0; i < roleArray.length; i++) {                        
                let roleData = new PractitionerRole({}, roleArray[i].resource);
                roleData.getFhirToJson();
                let roleObj = roleData.getRoleJson();
                let orgResource = FHIRData.find(e => e.resource.resourceType == "Organization" && e.fullUrl.includes(roleArray[i].resource.organization.reference));
                let orgData = new Organization({},orgResource.resource);
                orgData.getFHIRToTransformedResult();
                orgData = orgData.getOrgResource();
                roleObj.orgId = orgData.orgId;
                roleObj.orgName = orgData.orgName,
                roleObj.orgType = orgData.orgType;
                role.push(roleObj);
            }
            let data = {
                "practitionerId": practitionerData.fhirId,
                "firstName": practitionerData.firstName,
                "middleName": practitionerData.middleName,
                "lastName": practitionerData.lastName,
                "mobileNumber" : practitionerData.mobileNumber,
                "email": practitionerData.email,
                "address": practitionerData.address,
                "role": role
            }
            resourceResult.push(data);

        }        
        res.status(200).json({ status: resStatus, message: "Data fetched.", total: resourceResult.length,"offset": +queryParams?._offset, data: resourceResult  })
        
    }
    catch(e) {
        console.error("Error",e)
        return res.status(200).json({
                status: 0,
                message: "Unable to process. Please try again"
            })
       
    }
}


module.exports = {
    getPractitionerRoleData
}