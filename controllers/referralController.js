let axios = require("axios");
let config = require("../config/nodeConfig");
const ServiceRequest = require("../class/ReferralServiceRequest")
const Organization = require("../class/HealthFacilityOrganization")
const { v4: uuidv4 } = require('uuid');
const bundleStructure = require("../services/bundleOperation")
const responseService = require("../services/responseService");
const { fetchResource, buildFHIRResource, getTransformedResult } = require("../services/helperFunctions");
// const { riskFactorSchema } = require("../utils/Validator/referralValidator");
const {validateRequest} = require("../utils/validateRequest");
const { getPractitionerName } = require("../services/commonFunctions");

const fetchMainEncounter = async (riskFactorData, token) => {
    const mainEncounter =   await fetchResource("Encounter", {
         appointment: riskFactorData.appointmentId,
         _count: 5000,
         _include: "Encounter:appointment",
     }, token);
 
     return mainEncounter
 }
 

//  Save Practitioner data
let saveReferralData = async function (req, res) {
    try {
        // const validatedBody = validateRequest(req.body, riskFactorSchema, res);
        // if (!validatedBody) return;
        req.queueMeta = {
            data: req.body,
            entity: "referral",
            requestType: "post",
            apiName: "save-referral",
            tokenData: req.decoded
          };
        const token = req.accessToken;
        let resourceResult = [];
        const practitionerRoleData = await fetchResource("PractitionerRole", {practitioner: req.decoded.userId, active: true}, token);
        for (let referralData of req.body) {
            //  fetch appointment encounter
            const encounterData = await fetchMainEncounter(referralData, token)
            const reqUuid = referralData.uuid;
            const baseEncounterId = encounterData?.entry?.[0]?.resource?.id;
            if (!baseEncounterId) return;
            const existingResponse = await fetchResource("ServiceRequest", {subject: referralData.patientId, encounter: baseEncounterId, category: "referral", _total: "accurate"}, token);
            const practitionerRoleId = practitionerRoleData.entry[0].resource.id;
            if (existingResponse.total > 0 && existingResponse.entry) {
                console.log("put case")
                referralData.uuid = existingResponse.entry[0].resource.identifier.value;
                const serviceRequestResource = buildFHIRResource(ServiceRequest, {...referralData, encounterId: baseEncounterId, practitionerRoleId: practitionerRoleId})
                serviceRequestResource.uuid = reqUuid
                const serviceRequestBundle = await bundleStructure.setBundlePut(serviceRequestResource, null, existingResponse.entry[0].resource.id, "PUT", "identifier")
                resourceResult.push(serviceRequestBundle)
                }
            else {
                const serviceRequestResource = buildFHIRResource(ServiceRequest, {...referralData, encounterId: baseEncounterId, practitionerRoleId: practitionerRoleId})
                serviceRequestResource.uuid = reqUuid
                const serviceRequestBundle =await  bundleStructure.setBundlePost(serviceRequestResource,serviceRequestResource.identifier, referralData.uuid, "POST", "identifier")
                resourceResult.push(serviceRequestBundle)
            }
           
       }
        let bundleData = await bundleStructure.getBundleJSON({resourceResult})  
        // return res.status(201).json({ status: 1, message: "Referral data saved.", data: bundleData.bundle })
        let response = await axios.post(config.baseUrl, bundleData.bundle, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/fhir+json'
            }
        }); 
        console.info("get bundle json response: ", response.status)  
        if (response.status == 200 || response.status == 201) {
            let responseData = setSaveResponse(bundleData.bundle.entry, response.data.entry, "post");   
            res.status(201).json({ status: 1, message: "Referral data saved.", data: responseData })
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

const setSaveResponse  = (reqBundleData, responseBundleData, type) => {
    let filteredData = [];
    let response = [];
    const responseData = bundleStructure.mapAssessmentBundleService(reqBundleData, responseBundleData)
    filteredData = responseData.filter(e => e.resource.resourceType == "ServiceRequest");
    response = responseService.setDefaultAssessmentResponse("ServiceRequest", type, filteredData)
    console.info("responses: ============================>", filteredData)
    return response;
}



//  Get Referral data
let getReferralData = async function (req, res) {
    try {
        const token = req.accessToken;
        const link = config.baseUrl + "ServiceRequest"
        let specialOffset = null;
        const queryParams = req.query
        queryParams._total = "accurate";
        queryParams.category = "referral"
        let resourceResult = []
        let resourceUrlData = { link: link, reqQuery: queryParams, allowNesting: 0, specialOffset: specialOffset }
        let serviceRequestResources = await fetchResource("ServiceRequest", queryParams, token);
        let resStatus = 1;
        if(  serviceRequestResources.total == 0) {
                return res.status(200).json({ status: 2, message: "Data fetched", total: 0, data: []  })
        }
            
        resStatus = bundleStructure.setResponse(resourceUrlData, serviceRequestResources);
        const mainEncounterIds = serviceRequestResources.entry.map((e) => e.resource.encounter?.reference?.split("/")[1]).filter(Boolean).join(",");
        const mainEncounterList = await fetchResource("Encounter", { _id: mainEncounterIds, _count: req.query._count }, token);
        const mainEncounters = mainEncounterList.entry.map((e) => e.resource);
        for (const serviceRequestResponse of serviceRequestResources.entry) {        
            const responseObj = getTransformedResult(ServiceRequest, serviceRequestResponse.resource);
            const primaryEncounter = mainEncounters.find((e) => e.id === serviceRequestResponse.resource.encounter.reference.split("/")[1]);
            const practitionerRoleId = serviceRequestResources.entry.map((e) => e.resource.requester?.reference?.split("/")[1]).filter(Boolean).join(",");
            const practitionerResult = await fetchResource("Practitioner", { _count: 10000, "_has:PractitionerRole:practitioner:_id": practitionerRoleId }, token)
            const practitioner = practitionerResult.entry[0].resource;
            console.log("practitionerResult: ", practitioner)
            responseObj.practitionerId = practitioner.id;
            responseObj.practitionerName = getPractitionerName(practitioner.id, practitionerResult.entry);
            responseObj.appointmentId = primaryEncounter?.appointment?.[0]?.reference?.split("/")[1] || null;
            responseObj.appointmentUuid = primaryEncounter?.identifier?.[0].value
            resourceResult.push(responseObj)
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

const referralHospitals = async function (req, res) {
    try {
        const link = config.baseUrl + "Organization"
        const queryParams = req.query;
        queryParams.type = "health-facility"
        let resStatus = 1;
        const token = req.accessToken;
        queryParams._total = "accurate"
        let resourceResult = [];
        const responseResult = await fetchResource("Organization", queryParams, token);
        const responseData = responseResult.entry || []
        if( !responseData) {
            return res.status(200).json({ status: resStatus, message: "Data fetched", total: 0, data: []  })
        }
        else {            
            resStatus = bundleStructure.setResponse({ link: link, reqQuery: queryParams, allowNesting: 1, specialOffset: 1 }, responseResult);            
            for (let i = 0; i < responseData.length; i++) {
                const organization = getTransformedResult(Organization, responseData[i].resource);
                resourceResult.push(organization)                
            }
        }
        return res.status(200).json({ status: resStatus, message: "Data fetched.", total: resourceResult.length,"offset": +queryParams?._offset, data: resourceResult  })
       
    } 
    catch(error) {
        console.error("Error",error)
        return res.status(200).json({
                status: 0,
                message: "Unable to process. Please try again"
            })     
    }
}

module.exports = {
    saveReferralData, getReferralData, referralHospitals
}