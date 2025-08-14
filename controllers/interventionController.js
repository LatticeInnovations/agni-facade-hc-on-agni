const { getPractitionerName } = require("../services/commonFunctions");
let ServiceRequest = require("../class/ServiceRequest")
const {buildFHIRResource, fetchResource, handleError, getTransformedResult} = require("../services/helperFunctions");
let axios = require("axios");
let config = require("../config/nodeConfig");
const bundleStructure = require("../services/bundleOperation")
const responseService = require("../services/responseService");
let {interventionSchema} = require("../utils/Validator/interventionValidator");
const {validateRequest} = require("../utils/validateRequest");

const fetchMainEncounter = async (interventionData, token) => {
    const mainEncounter =   await fetchResource("Encounter", {
         appointment: interventionData.appointmentId,
         _count: 5000,
         _include: "Encounter:appointment",
     }, token);
 
     console.log(mainEncounter)
 
     return mainEncounter
 }

//  save Intervention data
let saveInterventionData = async function (req, res) {    
    try {
        const validatedBody = validateRequest(req.body, interventionSchema, res);
        if (!validatedBody) return;
        req.queueMeta = {
            data: req.data,
            entity: "intervention",
            requestType: "post",
            apiName: "add-intervention",
            tokenData: req.decoded
          };
        const token = req.accessToken;
        let resourceResult = [];
        console.log("req body: ", req.body)
        for (let interventionData of req.body) {
                const encounterData = await fetchMainEncounter(interventionData, token)
                const reqUuid = interventionData.uuid;
                const baseEncounterId = encounterData?.entry?.[0]?.resource?.id;
                if (!baseEncounterId) return;    
                const existingResponse = await fetchResource("ServiceRequest", {category: "409073007", encounter: baseEncounterId, _total: "accurate"}, token);
                interventionData.activityList = interventionData.interventions.map(e => "ActivityDefinition/" + e)
                if (existingResponse.total > 0 && existingResponse.entry) {
                    console.log("put case")
                    interventionData.uuid = existingResponse.entry[0].resource.identifier[0].value;
                    const interventionResponseResource = buildFHIRResource(ServiceRequest, {...interventionData, categoryCode: "409073007", categoryDisplay: "interventions" ,encounterId: baseEncounterId, practitionerId: req.decoded.userId})
                    console.log("interventionResponseResource: ", interventionResponseResource)
                    interventionResponseResource.uuid = reqUuid
                    const interventionResponseBundle = await bundleStructure.setBundlePut(interventionResponseResource, null, existingResponse.entry[0].resource.id, "PUT", "identifier")
                    resourceResult.push(interventionResponseBundle)
                    }
                else {
                    const interventionResponseResource = buildFHIRResource(ServiceRequest, {...interventionData, categoryCode: "409073007", categoryDisplay: "Interventions" ,encounterId: baseEncounterId, practitionerId: req.decoded.userId})
                    console.log("interventionResponseResource: ", interventionResponseResource)
                    interventionResponseResource.uuid = reqUuid
                    const interventionResponseBundle =await  bundleStructure.setBundlePost(interventionResponseResource, interventionResponseResource.identifier, interventionData.uuid, "POST", "identifier")
                    resourceResult.push(interventionResponseBundle)
                }  
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
                let responseData = setInterventionSaveResponse(bundleData.bundle.entry, response.data.entry, "post");   
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


const setInterventionSaveResponse  = (reqBundleData, responseBundleData, type) => {
    let filteredData = [];
       let response = [];
       const responseData = bundleStructure.mapAssessmentBundleService(reqBundleData, responseBundleData)
       filteredData = responseData.filter(e => e.resource.resourceType == "ServiceRequest");
       response = responseService.setDefaultAssessmentResponse("ServiceRequest", type, filteredData)
       console.info("responses: ============================>", filteredData)
       return response;
}

let getInterventionData = async function (req, res) {
    try {
        const token = req.accessToken;
        const link = config.baseUrl + "ServiceRequest";
        const queryParams = req.query
        queryParams.category = "409073007"
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
            responseObj.interventions = responseObj.activityList
            delete responseObj["activityList"]
            responseObj.appointmentId = primaryEncounter?.appointment?.[0]?.reference?.split("/")[1] || null;
            responseObj.appointmentUuid = primaryEncounter?.identifier?.[0].value
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
    getInterventionData
}