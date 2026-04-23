let Practitioner = require("../class/practitioner");
let axios = require("axios");
let config = require("../config/nodeConfig");
const { v4: uuidv4 } = require('uuid');
const bundleStructure = require("../services/bundleOperation")
const responseService = require("../services/responseService");
const { fetchResource, buildFHIRResource, getTransformedResult } = require("../services/helperFunctions");
const { practitionerSaveArraySchema, practitionerUpdateArraySchema } = require("../utils/Validator/practitionerValidator");
const {validateRequest} = require("../utils/validateRequest");
const PractitionerRole = require("../class/practitionerRole");


//  Save Practitioner data
let savePractitionerData = async function (req, res) {
    try {
        const resType = "Practitioner"
        const validatedBody = validateRequest(req.body, practitionerSaveArraySchema, res);
        if (!validatedBody) return;
        const token = req.accessToken; 
        let resourceResult = [];
        for (let practitionerData of req.body) {
            // Check if practitioner    
            let queryParam ={email: practitionerData.email, phone: practitionerData.mobileNumber, "_total": "accurate"};

            if(practitionerData.mobileNumber) {
                queryParam.phone = practitionerData.mobileNumber;
                let existingPractitionerMobile = await fetchResource("Practitioner", queryParam, token);
                if (+existingPractitionerMobile.total != 0) {
                    return res.status(422).json( { status: 0, message: "Practitioner data already exists."})
                }
            }
            if(practitionerData.email) {
                let existingPractitionerEmail = await fetchResource("Practitioner", {email: practitionerData.email}, token);
                if (+existingPractitionerEmail.total != 0) {
                     return res.status(422).json( { status: 0, message: "Practitioner data already exists."})
                }
            }
            let practitionerResource = buildFHIRResource(Practitioner, practitionerData);
            practitionerResource.resourceType = resType;
            practitionerResource.id = uuidv4();
            let practitionerBundle = await bundleStructure.setBundlePost(practitionerResource, practitionerResource.telecom, practitionerResource.id, "POST", "telecom"); 

            //  add PractitionerRole
            // 1. Find healthcare Id for practitioner
            const healthCareResource = await fetchResource("Organization", {type: "health-facility", identifier: practitionerData.healthFacilityCode}, token)
            const practitionerRoleResource = buildFHIRResource(PractitionerRole, {userId: "urn:uuid:"+practitionerResource.id, roleId: practitionerData.roleId, roleGroupId:practitionerData.roleGroupId, orgId: healthCareResource?.entry?.[0]?.resource?.id|| null});
            practitionerRoleResource.active = true;
            
            const practitionerRoleBundle = await bundleStructure.setBundlePost(practitionerRoleResource, null, uuidv4(), "POST", "identifier"); 

            console.info("Practitioner bundle: ", practitionerBundle) 
            resourceResult.push(practitionerBundle, practitionerRoleBundle);  
        
       }
        let bundleData = await bundleStructure.getBundleJSON({resourceResult})  
        // return res.status(201).json({ status: 1, message: "Practitioner data saved.", data: bundleData.bundle })
        let response = await axios.post(config.baseUrl, bundleData.bundle, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/fhir+json'
            }
        }); 
        console.info("get bundle json response: ", response.status)  
        if (response.status == 200 || response.status == 201) {
            let responseData = setPractitionerSaveResponse(bundleData.bundle.entry, response.data.entry, "post");        //    
            res.status(201).json({ status: 1, message: "Practitioner data saved.", data: responseData })
        }
        else {
                return res.status(500).json({
                status: 0, message: "Unable to process. Please try again.", err: response
            })
        }
    }
    catch (e) {
        console.error(e);
        return res.status(500).json({
            status: 0,
            message: "Unable to process. Please try again.",
            err: e
        })
    }

}
const isScreeningRole = (resource) => {
    console.log("resource code: ", resource.code)
    return resource?.code?.some(c =>
        c?.coding?.some(cd => cd.code === "SCREENING_STAFF")
    );
};

//  update Practitioner data
let updatePractitionerData = async function (req, res) {
    try {
        const resType = "Practitioner"
        let practitionerRoleResource = null;
        const validatedBody = validateRequest(req.body, practitionerUpdateArraySchema, res);
        if (!validatedBody) return;
        const token = req.accessToken;
        let resourceResult = [];
        const practitionerIds = req.body.map(e=>e.fhirId).join(",");
        const practitionerRoleData = await fetchResource("PractitionerRole", {practitioner: practitionerIds, active: true}, token);
        for (let practitionerData of req.body) {
            // Check if practitioner    
            let queryParam ={email: practitionerData.email, phone: practitionerData.mobileNumber, "_total": "accurate"};

            if(practitionerData.mobileNumber) {
                queryParam.phone = practitionerData.mobileNumber;
                let existingPractitionerMobile = await fetchResource("Practitioner", queryParam, token);
                if (+existingPractitionerMobile.total > 1) {
                    return res.status(422).json( { status: 0, message: "Practitioner data already exists."})
                }
            }
            if(practitionerData.email) {
                let existingPractitionerEmail = await fetchResource("Practitioner", {email: practitionerData.email}, token);
                if (+existingPractitionerEmail.total > 1) {
                     return res.status(422).json( { status: 0, message: "Practitioner data already exists."})
                }
            }
            let practitionerResource = buildFHIRResource(Practitioner, practitionerData);
            practitionerResource.resourceType = resType;
            practitionerResource.id = practitionerData.fhirId
            let practitionerBundle = await bundleStructure.setBundlePut(practitionerResource, null, practitionerResource.id, "PUT", "identifier"); 

            //  add PractitionerRole
            // 1. Find healthcare Id for practitioner
            const healthCareResource = practitionerData.healthFacilityId != null? await fetchResource("Organization", {type: "health-facility", _id: practitionerData.healthFacilityId}, token) : []
            const filteredRoles = practitionerRoleData.entry.filter(e => {
                const resource = e.resource;
                const practitionerMatch =
                    resource.practitioner.reference.split("/")[1] == practitionerData.fhirId;
                const notScreening = !isScreeningRole(resource);

                return practitionerMatch && notScreening;
            });

            const roleResource = filteredRoles[0];
            // const roleResourceIndex = practitionerRoleData.entry.findIndex(e => e.resource.practitioner.reference.split("/")[1] == practitionerData.fhirId);
            let practitionerRoleBundle = null;
            if(practitionerData.healthFacilityId == roleResource.resource.organization.reference.split("/")[1]) {
                practitionerRoleResource = buildFHIRResource(PractitionerRole, {userId: practitionerData.fhirId, roleId: practitionerData.roleId, roleGroupId:practitionerData.roleGroupId, orgId: healthCareResource?.entry?.[0]?.resource?.id|| null});
                practitionerRoleBundle = await bundleStructure.setBundlePut(practitionerRoleResource, null, roleResource.resource.id, "PUT", "identifier"); 
            }
            else {
                practitionerRoleResource = buildFHIRResource(PractitionerRole, {userId: practitionerData.fhirId, roleId: practitionerData.roleId, roleGroupId:practitionerData.roleGroupId, orgId: practitionerData.healthFacilityId|| null});
                practitionerRoleResource.active = true;
                const new_uuid = uuidv4();
                practitionerRoleBundle = await bundleStructure.setBundlePost(practitionerRoleResource, null, new_uuid, "POST", "identifier"); 
                const oldRoleResource = roleResource.resource;
                oldRoleResource.active = false;
                const oldRoleBundle = await bundleStructure.setBundlePut(oldRoleResource, null, oldRoleResource.id, "PUT", "identifier"); 
                resourceResult.push(oldRoleBundle)
            }

            
            

            console.info("Practitioner bundle: ", practitionerBundle) 
            resourceResult.push(practitionerBundle, practitionerRoleBundle);  
        
       }
        let bundleData = await bundleStructure.getBundleJSON({resourceResult})  
        // return res.status(201).json({ status: 1, message: "Practitioner data saved.", data: bundleData.bundle })
        let response = await axios.post(config.baseUrl, bundleData.bundle, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/fhir+json'
            }
        }); 
        console.info("get bundle json response: ", response.status)  
        if (response.status == 200 || response.status == 201) {
            let responseData = setPractitionerSaveResponse(bundleData.bundle.entry, response.data.entry, "post");        //    
            res.status(201).json({ status: 1, message: "Practitioner data saved.", data: responseData })
        }
        else {
                return res.status(500).json({
                status: 0, message: "Unable to process. Please try again.", err: response
            })
        }
    }
    catch (e) {
        console.error(e);
        return res.status(500).json({
            status: 0,
            message: "Unable to process. Please try again.",
            err: e
        })
    }

}



//  Get Practitioner data
let getPractitionerData = async function (req, res) {
    try {
        const link = config.baseUrl + "Practitioner"
        let specialOffset = null;
        const queryParams = req.query
        queryParams._total = "accurate";
        let resourceResult = []
        const token = req.accessToken;
        let resourceUrlData = { link: link, reqQuery: queryParams, allowNesting: 1, specialOffset: specialOffset }
        let responseData = await fetchResource("Practitioner", queryParams, token);
        let resStatus = 1;
        if( !responseData.entry || responseData.total == 0) {
                return res.status(200).json({ status: resStatus, message: "Data fetched", total: 0, data: []  })
        }
        else {            
            resStatus = bundleStructure.setResponse(resourceUrlData, responseData);
            // get practitionerRole
            const practitionerIds = responseData.entry.map(e=>e.resource.id).join(",");
            
            const practitionerRoleData = await fetchResource("PractitionerRole", {practitioner: practitionerIds, active:true}, token);
            for (let i = 0; i < responseData.entry.length; i++) {
                let practitioner = getTransformedResult(Practitioner, responseData.entry[i].resource);
                const roleResourceIndex = practitionerRoleData.entry.findIndex(e => e.resource.practitioner.reference.split("/")[1] == practitioner.fhirId)
                // console.log("roleResource: ",practitionerRoleData.entry[roleResourceIndex], practitioner.fhirId)
                const roleObj = getTransformedResult(PractitionerRole, practitionerRoleData?.entry?.[roleResourceIndex]?.resource || {})
                console.log("roleObj: ", roleObj)
                practitioner.role = roleObj?.role || null;
                practitioner.roleGroup = roleObj?.roleGroup || null;
                practitioner.healthFacilityId = roleObj?.orgId || null
                resourceResult.push(practitioner)                
            }
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


//  Patch Practitioner data
let patchPractitionerData = async function (req, res) {
    try {
        const resType = "Practitioner"
        let resourceResult = [];
        const token = req.accessToken;
        for (let inputData of req.body) {
            let practitioner = new Practitioner(inputData, []);
            let resourceSavedData = await fetchResource("Practitioner", { "_id": inputData.fhirId }, token)
            if (resourceSavedData.total != 1) {
               return res.status(422).json({ status: 0, code: "ERR", message: "Practitioner Id " + inputData.fhirId + " does not exist."})
            }
            practitioner.setPatchData(resourceSavedData.entry[0].resource);
            let resourceData = [...practitioner.getFHIRResource()];
            const patchUrl = resType + "/" + inputData.fhirId;
            let patchResource = await bundleStructure.setBundlePatch(resourceData, patchUrl);
            resourceResult.push(patchResource);
        }
        let bundleData = await bundleStructure.getBundleJSON({resourceResult})  
        let response = await axios.post(config.baseUrl, bundleData.bundle, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/fhir+json'
            }
        }); 
        console.info("get bundle json response: ", response.status)  
        if (response.status == 200 || response.status == 201) {
            let responseData = setPractitionerSaveResponse(bundleData.bundle.entry, response.data.entry, "patch"); 
            res.status(201).json({ status: 1, message: "Practitioner active value updated.", data: responseData })
        }
        else {
                return res.status(500).json({
                status: 0, message: "Unable to process. Please try again.", err: response
            })
        }
    }
    catch (e) {
        console.error(e);
        return res.status(500).json({
            status: 0,
            message: "Unable to process. Please try again.",
            err: e
        })
    }

}



const setPractitionerSaveResponse  = (reqBundleData, responseBundleData, type) => {
    let filteredData = [];
    let response = [];
    const responseData = bundleStructure.mapBundleService(reqBundleData, responseBundleData)
    filteredData = responseData.filter(e => e.resource.resourceType == "Practitioner" || (type == "patch" && e.resource.resourceType == "Binary") );
    response = responseService.setDefaultResponse("Practitioner", type, filteredData)
    console.info("responses: ============================>", filteredData)
    return response;
}


module.exports = {
    savePractitionerData,
    getPractitionerData,
    patchPractitionerData,
    updatePractitionerData
}