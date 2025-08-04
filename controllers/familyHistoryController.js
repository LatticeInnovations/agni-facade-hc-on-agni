let Questionnaire = require("../class/FamilyHistoryQuestionnaire");
let QuestionnaireResponse = require("../class/FamilyHistoryQuestionnaireResponse")
let axios = require("axios");
let config = require("../config/nodeConfig");
const { v4: uuidv4 } = require('uuid');
const bundleStructure = require("../services/bundleOperation")
const responseService = require("../services/responseService");
const { fetchResource, buildFHIRResource, getTransformedResult } = require("../services/helperFunctions");
const { familyHistorySchema } = require("../utils/Validator/familyHistoryValidator");
const {validateRequest} = require("../utils/validateRequest");
const { getPractitionerName } = require("../services/commonFunctions");

const fetchMainEncounter = async (familyHistoryData, token) => {
    const mainEncounter =   await fetchResource("Encounter", {
         appointment: familyHistoryData.appointmentId,
         _count: 5000,
         _include: "Encounter:appointment",
     }, token);
 
     console.log(mainEncounter)
 
     return mainEncounter
 }
 

//  Save Practitioner data
let saveFamilyHistoryData = async function (req, res) {
    try {
        const validatedBody = validateRequest(req.body, familyHistorySchema, res);
        if (!validatedBody) return;
        req.queueMeta = {
            data: req.body,
            entity: "familyHistory",
            requestType: "post",
            apiName: "save-family-history",
            tokenData: req.decoded
          };
        const token = req.accessToken;
        let resourceResult = [];
        let questionnaireId = null;
        let questionnaireReference = null;
        //  Get Questionnaire id if it not exists create it and pass as reference for uuid
        const questionnaireResource = await fetchResource("Questionnaire", {name: "family-history-questionnaire", _total: "accurate", _count: 1}, token)
        if(questionnaireResource.total > 0) {
            questionnaireId = questionnaireResource.entry[0].resource.id;
            questionnaireReference = "Questionnaire/" + questionnaireId;        
        }            
        else {
           questionnaireId = uuidv4(); 
           questionnaireReference = "urn:uuid:" + questionnaireId
           const questionnaireResourceBuilt = buildFHIRResource(Questionnaire, {questionnaireId});
           const questionnaireBundle = await bundleStructure.setBundlePost(questionnaireResourceBuilt, questionnaireResourceBuilt.identifier, questionnaireId, "POST", "identifier")
           resourceResult.push(questionnaireBundle);
        }
        for (let familyHistoryData of req.body) {
            //  fetch appointment encounter
            const encounterData = await fetchMainEncounter(familyHistoryData, token)
            const baseEncounterId = encounterData?.entry?.[0]?.resource?.id;
            if (!baseEncounterId) return;

            const existingResponse = await fetchResource("QuestionnaireResponse", {source: familyHistoryData.patientId, encounter: baseEncounterId, questionnaire: questionnaireId, _total: "accurate"}, token);
            if (existingResponse.total > 0 && existingResponse.entry) {
                console.log("put case")
                const reqUuid = familyHistoryData.uuid;
                familyHistoryData.uuid = existingResponse.entry[0].resource.identifier.value;
                const questionnaireResponseResource = buildFHIRResource(QuestionnaireResponse, {...familyHistoryData, questionnaireId: questionnaireReference, encounterId: baseEncounterId, practitionerId: req.decoded.userId})
                console.log("questionnaireResponseResource: ", questionnaireResponseResource)
                questionnaireResponseResource.uuid = reqUuid
                const questionnaireResponseBundle = await bundleStructure.setBundlePut(questionnaireResponseResource, null, existingResponse.entry[0].resource.id, "PUT", "identifier")
                resourceResult.push(questionnaireResponseBundle)
                }
            else {
                const questionnaireResponseResource = buildFHIRResource(QuestionnaireResponse, {...familyHistoryData, questionnaireId: questionnaireReference, encounterId: baseEncounterId, practitionerId: req.decoded.userId})
                console.log("questionnaireResponseResource: ", questionnaireResponseResource)
                questionnaireResponseResource.uuid = familyHistoryData.uuid
                const questionnaireResponseBundle =await  bundleStructure.setBundlePost(questionnaireResponseResource,[questionnaireResponseResource.identifier], familyHistoryData.uuid, "POST", "identifier")
                resourceResult.push(questionnaireResponseBundle)
            }
           
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
            let responseData = setSaveResponse(bundleData.bundle.entry, response.data.entry, "post");   
            res.status(201).json({ status: 1, message: "Family history data saved.", data: responseData })
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
    filteredData = responseData.filter(e => e.resource.resourceType == "QuestionnaireResponse");
    response = responseService.setDefaultAssessmentResponse("QuestionnaireResponse", type, filteredData)
    console.info("responses: ============================>", filteredData)
    return response;
}



//  Get medication history data
let getFamilyHistoryData = async function (req, res) {
    try {
        const token = req.accessToken;
        const questionnaireResource = await fetchResource("Questionnaire", {name: "family-history-questionnaire", _total: "accurate", _count: 1}, token)
        if(questionnaireResource.total == 0) {
            return res.status(200).json({ status: 2, message: "Data fetched", total: 0, data: []  })
        }         
        const link = config.baseUrl + "QuestionnaireResponse"
        let specialOffset = null;
        const queryParams = req.query
        queryParams._total = "accurate";
        queryParams.questionnaire = "Questionnaire/" + questionnaireResource.entry[0].resource.id
        let resourceResult = []
        let resourceUrlData = { link: link, reqQuery: queryParams, allowNesting: 0, specialOffset: specialOffset }
        console.log("resourceUrlData; ", resourceUrlData)
        let questionnaireResponses = await fetchResource("QuestionnaireResponse", queryParams, token);
        let resStatus = 1;
        if(  questionnaireResponses.total == 0) {
                return res.status(200).json({ status: 2, message: "Data fetched", total: 0, data: []  })
        }
            
        resStatus = bundleStructure.setResponse(resourceUrlData, questionnaireResponses);
        const mainEncounterIds = questionnaireResponses.entry.map((e) => e.resource.encounter?.reference?.split("/")[1]).filter(Boolean).join(",");
        const mainEncounterList = await fetchResource("Encounter", { _id: mainEncounterIds, _count: req.query._count }, token);
        //  get practitionerData
        const practitionerIds = questionnaireResponses.entry.map((e) => e.resource.author?.reference?.split("/")[1]).filter(Boolean).join(",");
        const practitionerList = await fetchResource("Practitioner", { _count: 10000, _id: practitionerIds }, token)
        const mainEncounters = mainEncounterList.entry.map((e) => e.resource);
        questionnaireResponses.entry.forEach(questionnaireResponse => {            
            const responseObj = getTransformedResult(QuestionnaireResponse, questionnaireResponse.resource);
            const primaryEncounter = mainEncounters.find((e) => e.id === questionnaireResponse.resource.encounter.reference.split("/")[1]);
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
    saveFamilyHistoryData, getFamilyHistoryData
}