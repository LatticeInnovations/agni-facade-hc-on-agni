let AllergyIntolerance = require("../class/AllergyIntolerance")
let axios = require("axios");
let config = require("../config/nodeConfig");
const bundleStructure = require("../services/bundleOperation")
const responseService = require("../services/responseService");
const { fetchResource, buildFHIRResource, getTransformedResult } = require("../services/helperFunctions");
const { allergySchema } = require("../utils/Validator//allergyValidator");
const {validateRequest} = require("../utils/validateRequest");
const { getPractitionerName } = require("../services/commonFunctions");
const { publishReportJob } = require("../middleware/reportPublisher");
const { saveToken } = require("../services/email/tokenStore");

const fetchMainEncounter = async (allergyData, token) => {
    const mainEncounter =   await fetchResource("Encounter", {
         appointment: allergyData.appointmentId,
         _count: 5000,
         _include: "Encounter:appointment",
     }, token);
 
     return mainEncounter
 }
 

//  Save Practitioner data
let saveAllergyData = async function (req, res) {
    try {
        const validatedBody = validateRequest(req.body, allergySchema, res);
        if (!validatedBody) return;
        req.queueMeta = {
            data: req.body,
            entity: "allergy",
            requestType: "post",
            apiName: "save-allergy",
            tokenData: req.decoded
          };
        let resourceResult = [];
          const token = req.accessToken

        for (let allergyData of req.body) {
            //  fetch appointment encounter
            const encounterData = await fetchMainEncounter(allergyData, token)
            const baseEncounterId = encounterData?.entry?.[0]?.resource?.id;
            let allergyIntoleranceBundle = null;
            if (!baseEncounterId) return;

            const existingResponses = await fetchResource("AllergyIntolerance", {patient: allergyData.patientId, _total: "accurate", _count: 1000}, token);
            if (existingResponses.total > 0 && existingResponses.entry) {
                const currentAllergyData = existingResponses.entry.filter(e=> e.resource.encounter.reference.split("/")[1] === baseEncounterId);
                if(currentAllergyData.length > 0){
                    const reqUuid = allergyData.uuid;
                    allergyData.uuid = currentAllergyData[0].resource.identifier?.[0]?.value || allergyData.uuid;
                    const allergyResource = buildFHIRResource(AllergyIntolerance, {...allergyData,  encounterId: baseEncounterId, practitionerId: req.decoded.userId})
                    allergyResource.uuid = reqUuid;
                    allergyIntoleranceBundle = await bundleStructure.setBundlePut(allergyResource, null, currentAllergyData[0].resource.id, "PUT", "identifier")                    
                }
                else {
                    allergyIntoleranceBundle = await createNewAllergyResource(allergyData, baseEncounterId, req)
                }

                }
            else {
                allergyIntoleranceBundle= await createNewAllergyResource(allergyData, baseEncounterId, req)
            }
            resourceResult.push(allergyIntoleranceBundle)
           
       }
        let bundleData = await bundleStructure.getBundleJSON({resourceResult})  
        // return res.status(201).json({ status: 1, message: "Family history data saved.", data: bundleData.bundle })
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
            let responseData = setSaveResponse(bundleData.bundle.entry, response.data.entry, "post");   
            res.status(201).json({ status: 1, message: "Allergy history data saved.", data: responseData })
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
const createNewAllergyResource = async (allergyData, baseEncounterId, req) => {
    const allergyResource = buildFHIRResource(AllergyIntolerance, {...allergyData, encounterId: baseEncounterId, practitionerId: req.decoded.userId})
    allergyResource.uuid = allergyData.uuid
    const allergyIntoleranceBundle =await  bundleStructure.setBundlePost(allergyResource,[allergyResource.identifier], allergyData.uuid, "POST", "identifier")
    return allergyIntoleranceBundle;
                
}

const setSaveResponse  = (reqBundleData, responseBundleData, type) => {
    let filteredData = [];
    let response = [];
    const responseData = bundleStructure.mapAssessmentBundleService(reqBundleData, responseBundleData)
    filteredData = responseData.filter(e => e.resource.resourceType == "AllergyIntolerance");
    response = responseService.setDefaultAssessmentResponse("AllergyIntolerance", type, filteredData)
    console.info("responses: ============================>", filteredData)
    return response;
}



//  Get medication history data
let getAllergyData = async function (req, res) {
    try {
    
        const link = config.baseUrl + "AllergyIntolerance"
        let specialOffset = null;
        const queryParams = req.query
        queryParams._total = "accurate";
        const token = req.accessToken;
        let resourceResult = []
        let resourceUrlData = { link: link, reqQuery: queryParams, allowNesting: 0, specialOffset: specialOffset }
        let allergyIntoleranceResponses = await fetchResource("AllergyIntolerance", queryParams, token);
        let resStatus = 1;
        if(  allergyIntoleranceResponses.total == 0) {
                return res.status(200).json({ status: 2, message: "Data fetched", total: 0, data: []  })
        }
            
        resStatus = bundleStructure.setResponse(resourceUrlData, allergyIntoleranceResponses);
        const mainEncounterIds = allergyIntoleranceResponses.entry.map((e) => e.resource.encounter?.reference?.split("/")[1]).filter(Boolean).join(",");
        const mainEncounterList = await fetchResource("Encounter", { _id: mainEncounterIds, _count: req.query._count }, token);
        //  get practitionerData
        const practitionerIds = allergyIntoleranceResponses.entry.map((e) => e.resource.recorder?.reference?.split("/")[1]).filter(Boolean).join(",");
        const practitionerList = await fetchResource("Practitioner", { _count: 10000, _id: practitionerIds }, token)
        const mainEncounters = mainEncounterList.entry.map((e) => e.resource);
        allergyIntoleranceResponses.entry.forEach(allergyIntolerance => {            
            const responseObj = getTransformedResult(AllergyIntolerance, allergyIntolerance.resource);
            const primaryEncounter = mainEncounters.find((e) => e.id === allergyIntolerance.resource.encounter.reference.split("/")[1]);
            responseObj.practitionerName = getPractitionerName(responseObj.practitionerId, practitionerList.entry);
    
            responseObj.appointmentId = primaryEncounter?.appointment?.[0]?.reference?.split("/")[1] || null;
            responseObj.appointmentUuid = primaryEncounter?.identifier?.[0].value
            resourceResult.push(responseObj)
        });
        
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
    saveAllergyData, getAllergyData
}