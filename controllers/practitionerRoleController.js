let Practitioner = require("../class/practitioner");
let PractitionerRole = require("../class/practitionerRole");
let Organization = require("../class/Organization");
const { fetchResource, getTransformedResult } = require("../services/helperFunctions");



//  Get Practitioner data
let getPractitionerRoleData = async function (req, res) {
    try {
        let role = [];
        const queryParams = {
            "practitioner" : req.query.practitionerId,
            "_include": "*",
            "_total": "accurate"
        }
        let resourceResult = [];
        let responseData = await fetchResource("PractitionerRole", queryParams);
        let resStatus = 1;
        if( !responseData.entry || responseData.total == 0) {
                return res.status(200).json({ status: resStatus, message: "Data fetched", total: 0, data: []  })
        }
        else { 
            const FHIRData =  responseData.entry;      
            let practitioner = FHIRData.find(e => e.resource.resourceType == "Practitioner");
            let practitionerData = getTransformedResult(Practitioner, practitioner.resource);
            let roleArray = FHIRData.filter(e => e.resource.resourceType == "PractitionerRole");
            for (let i = 0; i < roleArray.length; i++) {                        
                const roleObj =getTransformedResult(PractitionerRole, roleArray[i].resource);
                let orgResource = FHIRData.find(e => e.resource.resourceType == "Organization" && e.fullUrl.includes(roleArray[i].resource.organization.reference));
                const orgData = getTransformedResult(Organization, orgResource.resource);
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