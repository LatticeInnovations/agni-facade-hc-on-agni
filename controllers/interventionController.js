const { getPractitionerName } = require("../services/commonFunctions");
let ServiceRequest = require("../class/ServiceRequest")
const {buildFHIRResource, fetchResource, handleError, getTransformedResult, getAPIPath} = require("../services/helperFunctions");
let axios = require("axios");
let config = require("../config/nodeConfig");
const bundleStructure = require("../services/bundleOperation")
const responseService = require("../services/responseService");
let {interventionSchema, interventionUpdateSchema} = require("../utils/Validator/interventionValidator");
const {validateRequest} = require("../utils/validateRequest");
const { publishReportJob } = require("../middleware/reportPublisher");
const { saveToken } = require("../services/email/tokenStore");

const fetchMainEncounter = async (examData, token, mainEncounterType) => {
    const mainEncounter =   await fetchResource("Encounter", {
         appointment: examData.appointmentId,
         _count: 5000,
         _include: "Encounter:appointment",
         type: mainEncounterType
     }, token);
 
     return mainEncounter
 }

 function applyNonCampaignSideEffects(req) {
        
    req.queueMeta = {
        data: req.data,
        entity: "intervention",
        requestType: "post",
        apiName: "add-intervention",
        tokenData: req.decoded
      };
}


//  save Intervention data
let saveInterventionData = async function (req, res) {    
    try {
        const isCampaignPath = await getAPIPath(req);
        console.log("check is it campaign path: ", isCampaignPath)

        const validatedBody = validateRequest(req.body, interventionSchema, res);
        if (!validatedBody) return;

        if (!isCampaignPath) applyNonCampaignSideEffects(req);
        
        const token = req.accessToken;
        let resourceResult = [];
        const allResourceResults = [], errData = [];
        const mainEncounterType = isCampaignPath ? "screening-site-main-encounter" : "facility-main-encounter";
        const serviceRequestCode = isCampaignPath ? "screening-site-409073007": "409073007";
        await Promise.all(

            req.body.map(async (interventionData) =>  {
                const encounterData = await fetchMainEncounter(interventionData, token, mainEncounterType);
                console.log("encounterData: ", encounterData)
                const reqUuid = interventionData.uuid;
                const baseEncounterId = encounterData?.entry?.[0]?.resource?.id;
                if (!baseEncounterId) {
                    errData.push({
                      status: 0,
                      id: reqUuid,
                      err: "Main encounter not found",
                      fhirId: null,
                    });
                    return;
                  }
                const existingServiceResponse = await fetchResource("ServiceRequest", {category: serviceRequestCode, encounter: baseEncounterId, _total: "accurate"}, token);
                const existingCount =  existingServiceResponse?.total ??  existingServiceResponse?.entry?.length ??  0;
                if (isCampaignPath && existingCount > 0) {
                console.info(
                    `ServiceRequest already exists for encounter ${baseEncounterId}, skipping...`
                );
                errData.push({
                    status: 0,
                    id: reqUuid,
                    err: "Intervention already exists for this encounter",
                    fhirId:
                    existingServiceResponse?.entry?.[0]?.resource?.id ?? null,
                });
                return;
                }

                interventionData.activityList = interventionData.interventions.map(e => "ActivityDefinition/" + e)
                const interventionResponseResource = buildFHIRResource(ServiceRequest, {...interventionData, categoryCode: serviceRequestCode, categoryDisplay: "Interventions" ,encounterId: baseEncounterId, practitionerId: req.decoded.userId})
                interventionResponseResource.uuid = reqUuid
                const interventionResponseBundle =await  bundleStructure.setBundlePost(interventionResponseResource, interventionResponseResource.identifier, interventionData.uuid, "POST", "identifier")
                resourceResult.push(interventionResponseBundle);
                allResourceResults.push(...resourceResult);
        }             
           
            ));

            if (allResourceResults.length === 0) {
                return res.status(200).json({
                    status: 1,
                    message: "Intervention data saved.",
                    data: errData
                });
            }

            let bundleData = await bundleStructure.getBundleJSON({resourceResult})  
            // return res.status(201).json({ status: 1, message: "Intervention data saved.", data: bundleData.bundle })
            let response = await axios.post(config.baseUrl, bundleData.bundle, {
                headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/fhir+json'
                        }
                    }); 
                    console.info("get bundle json response: ", response.status)  
            if (response.status == 200 || response.status == 201) {
                const patientIds = [...new Set(req.body.map(cvd => cvd.patientId))];
                await saveToken(token);
                for (const patientId of patientIds) {
                    await publishReportJob(patientId);
                }  
                let resourceResponse = setInterventionSaveResponse(bundleData.bundle.entry, response.data.entry, "post");  
                   const responseData = [...resourceResponse, ...errData];   
                res.status(201).json({ status: 1, message: "Intervention data saved.", data: responseData })
            }
            else {
                return res.status(500).json({  status: 0, message: "Unable to process. Please try again.", err: response  })
            }
    }
    catch (error) {
        console.error("saveInterventionData Error: ", error);
        error.code && error.code == "ERR" ? handleError(res, error, error.statusCode, error.message ) :  handleError(res, error)
    }

}

function applyNonCampaignSideEffectsOnUpdate(req) {
        
    req.queueMeta = {
        data: req.data,
        entity: "intervention",
        requestType: "put",
        apiName: "update-intervention",
        tokenData: req.decoded
      };
}


//  save Intervention data
let updateInterventionData = async function (req, res) {    
    try {
        const isCampaignPath = await getAPIPath(req);
        console.log("check is it campaign path: ", isCampaignPath)
        const mainEncounterType = isCampaignPath ? "screening-site-main-encounter" : "facility-main-encounter";
        const validatedBody = validateRequest(req.body, interventionUpdateSchema, res);
        if (!validatedBody) return;

        if (!isCampaignPath) applyNonCampaignSideEffectsOnUpdate(req);

        const token = req.accessToken;
        const category = isCampaignPath ? "screening-site-409073007" : "409073007"
        let resourceResult = [];
        for (let interventionData of req.body) {
                const encounterData = await fetchMainEncounter(interventionData, token, mainEncounterType)
                const reqUuid = interventionData.uuid;
                const baseEncounterId = encounterData?.entry?.[0]?.resource?.id;
                if (!baseEncounterId) return;    
                const existingResponse = await fetchResource("ServiceRequest", {category: category, encounter: baseEncounterId, _total: "accurate"}, token);
                console.log("existingResponse: ", existingResponse)
                interventionData.activityList = interventionData.interventions.map(e => "ActivityDefinition/" + e)
                    interventionData.uuid = existingResponse.entry[0].resource.identifier[0].value;
                    const interventionResponseResource = buildFHIRResource(ServiceRequest, {...interventionData, categoryCode: category, categoryDisplay: "interventions" ,encounterId: baseEncounterId, practitionerId: req.decoded.userId})
                    interventionResponseResource.uuid = reqUuid;
                    const interventionResponseBundle = await bundleStructure.setBundlePut(interventionResponseResource, null, existingResponse.entry[0].resource.id, "PUT", "identifier")
                    resourceResult.push(interventionResponseBundle) 
        }             
           
            let bundleData = await bundleStructure.getBundleJSON({resourceResult})  
                    // return res.status(201).json({ status: 1, message: "Intervention data saved.", data: bundleData.bundle })
            let response = await axios.post(config.baseUrl, bundleData.bundle, {
                headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/fhir+json'
                        }
                    }); 
                    console.info("get bundle json response: ", response.status)  
            if (response.status == 200 || response.status == 201) {
                const patientIds = [...new Set(req.body.map(cvd => cvd.patientId))];
                await saveToken(token);
                for (const patientId of patientIds) {
                    await publishReportJob(patientId);
                }
                let responseData = setInterventionSaveResponse(bundleData.bundle.entry, response.data.entry, "put");   
                res.status(201).json({ status: 1, message: "Intervention data updated.", data: responseData })
            }
            else {
                return res.status(500).json({  status: 0, message: "Unable to process. Please try again.", err: response  })
            }
    }
    catch (error) {
        console.error("saveInterventionData Error: ", error);
        error.code && error.code == "ERR" ? handleError(res, error, error.statusCode, error.message ) :  handleError(res, error)
    }

}


const setInterventionSaveResponse  = (reqBundleData, responseBundleData, type) => {
    let filteredData = [];
       let response = [];
       const responseData = bundleStructure.mapBundleService(reqBundleData, responseBundleData)
       filteredData = responseData.filter(e => e.resource.resourceType == "ServiceRequest");
       response = responseService.setDefaultResponse("ServiceRequest", type, filteredData)
       console.info("responses: ============================>", filteredData)
       return response;
}

let getInterventionData = async function (req, res) {
    try {
        const isCampaignPath = await getAPIPath(req);
        console.log("check is it campaign path: ", isCampaignPath)
        const token = req.accessToken;
        const link = config.baseUrl + "ServiceRequest";
        const queryParams = req.query
        queryParams.category =  isCampaignPath ? "screening-site-409073007" :"409073007"
        queryParams._total = "accurate";
        let resourceResult = []
        let resourceUrlData = { link: link, reqQuery: queryParams, allowNesting: 0, specialOffset: 1 }
        let interventionResponses = await fetchResource("ServiceRequest", queryParams, token);
        let resStatus = 1;
        if(  interventionResponses.total == 0) {
                return res.status(200).json({ status: 2, message: "Data fetched", total: 0, data: []  })
        }
            
        resStatus = bundleStructure.setResponse(resourceUrlData, interventionResponses);
        const mainEncounterIds = interventionResponses.entry.map((e) => e.resource.encounter?.reference?.split("/")[1]).filter(Boolean).join(",");
        const mainEncounterList = await fetchResource("Encounter", { _id: mainEncounterIds, _count: req.query._count }, token);
        const mainEncounters = mainEncounterList.entry.map((e) => e.resource);
        const practitionerIds = interventionResponses.entry.map((e) => e.resource.author?.reference?.split("/")[1]).filter(Boolean).join(",");
        const practitionerList = await fetchResource("Practitioner", { _count: 10000, _id: practitionerIds }, token)
        interventionResponses.entry.forEach(interventionResponse => {            
            const responseObj = getTransformedResult(ServiceRequest, interventionResponse.resource);
            const primaryEncounter = mainEncounters.find((e) => e.id === interventionResponse.resource.encounter.reference.split("/")[1]);
            responseObj.practitionerName = getPractitionerName(responseObj.practitionerId, practitionerList.entry);
            responseObj.practitionerId = responseObj.practitionerId;
            responseObj.interventions = responseObj?.activityList || []
            delete responseObj["activityList"]
            responseObj.appointmentId = primaryEncounter?.appointment?.[0]?.reference?.split("/")[1] || null;
            responseObj.appointmentUuid = primaryEncounter?.identifier?.[0].value;
            responseObj.campaignId = isCampaignPath ? primaryEncounter.location[0].location.reference.split("/")[1]: null;
            resourceResult.push(responseObj)
        });
        
        res.status(200).json({ status: resStatus, message: "Data fetched.", total: resourceResult.length,"offset": +queryParams?._offset, data: resourceResult  })
        
    }
    catch(error) {
        console.error("getInterventionData Error",error)
        return handleError(res, error);       
    }
}

module.exports = {
    saveInterventionData,
    updateInterventionData,
    getInterventionData
}