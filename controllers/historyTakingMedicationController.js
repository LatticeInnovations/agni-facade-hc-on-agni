let Questionnaire = require("../class/HistoryMedicationQuestionnaire");
let QuestionnaireResponse = require("../class/HistoryTakingQuestionnaireResponse")
let axios = require("axios");
let config = require("../config/nodeConfig");
const { v4: uuidv4 } = require('uuid');
const bundleStructure = require("../services/bundleOperation")
const responseService = require("../services/responseService");
const { fetchResource, buildFHIRResource, getTransformedResult } = require("../services/helperFunctions");
const { historyTakingSchema } = require("../utils/Validator/historyTakingValidator");
const {validateRequest} = require("../utils/validateRequest");

const fetchMainEncounter = async (medicationData) => {
    const mainEncounter =   await fetchResource("Encounter", {
         appointment: medicationData.appointmentId,
         _count: 5000,
         _include: "Encounter:appointment",
     });
 
     console.log(mainEncounter)
 
     return mainEncounter
 }
 

//  Save Practitioner data
let saveHistoryMedicationData = async function (req, res) {
    try {
        const validatedBody = validateRequest(req.body, historyTakingSchema, res);
        if (!validatedBody) return;
        req.queueMeta = {
            data: req.body,
            entity: "medicationHistory",
            requestType: "post",
            apiName: "save-medical-history",
            tokenData: req.decoded
          };
        let resourceResult = [];
        let questionnaireId = null;
        let questionnaireReference = null;
        //  Get Questionnaire id if it not exists create it and pass as reference for uuid
        const questionnaireResource = await fetchResource("Questionnaire", {name: "history-medication-questionnaire", _total: "accurate", _count: 1})
        if(questionnaireResource.total > 0) {
            questionnaireId = questionnaireResource.entry[0].resource.id;
            questionnaireReference = "Questionnaire/" + questionnaireId;        
        }            
        else {
           questionnaireId = uuidv4(); 
           questionnaireReference = "urn:uuid:" + questionnaireId
           const questionnaireResourceBuilt = buildFHIRResource(Questionnaire, {questionnaireId});
           const questionnaireBundle = await bundleStructure.setBundlePost(questionnaireResourceBuilt, [questionnaireResourceBuilt.identifier], questionnaireId, "POST", "identifier")
           resourceResult.push(questionnaireBundle);
        }
        for (let medicationData of req.body) {
            //  fetch appointment encounter
            const encounterData = await fetchMainEncounter(medicationData)
            const baseEncounterId = encounterData?.entry?.[0]?.resource?.id;
            if (!baseEncounterId) return;

            const existingResponse = await fetchResource("QuestionnaireResponse", {source: medicationData.patientId, encounter: baseEncounterId, questionnaire: questionnaireId, _total: "accurate"});
            if (existingResponse.total > 0) {
                console.log("put case")
                medicationData.uuid = existingResponse.entry[0].resource.identifier.value;
                const questionnaireResponseResource = buildFHIRResource(QuestionnaireResponse, {...medicationData, questionnaireId: questionnaireReference, encounterId: baseEncounterId, practitionerId: req.decoded.userId})
                console.log("questionnaireResponseResource: ", questionnaireResponseResource)
                const questionnaireResponseBundle = await bundleStructure.setBundlePut(questionnaireResponseResource, null, existingResponse.entry[0].resource.id, "PUT", "identifier")
                resourceResult.push(questionnaireResponseBundle)
                }
            else {
                const questionnaireResponseResource = buildFHIRResource(QuestionnaireResponse, {...medicationData, questionnaireId: questionnaireReference, encounterId: baseEncounterId, practitionerId: req.decoded.userId})
                console.log("questionnaireResponseResource: ", questionnaireResponseResource)
                const questionnaireResponseBundle =await  bundleStructure.setBundlePost(questionnaireResponseResource,[questionnaireResponseResource.identifier], medicationData.uuid, "POST", "identifier")
                resourceResult.push(questionnaireResponseBundle)
            }
           
       }
        let bundleData = await bundleStructure.getBundleJSON({resourceResult})  
        // return res.status(201).json({ status: 1, message: "Medication history data saved.", data: bundleData.bundle })
        let response = await axios.post(config.baseUrl, bundleData.bundle); 
        console.info("get bundle json response: ", response.status)  
        if (response.status == 200 || response.status == 201) {
            let responseData = setSaveResponse(bundleData.bundle.entry, response.data.entry, "post");   
            res.status(201).json({ status: 1, message: "Save history medication data saved.", data: responseData })
        }
        else {
                return res.status(500).json({
                status: 0, message: "Unable to process. Please try again.", error: response
                })
        }
    }
    catch (e) {
        console.error(e);
        return res.status(500).json({
            status: 0,
            message: "Unable to process. Please try again.",
            error: e
        })
    }

}

const setSaveResponse  = (reqBundleData, responseBundleData, type) => {
    let filteredData = [];
    let response = [];
    const responseData = bundleStructure.mapAssessmentBundleService(reqBundleData, responseBundleData)
    filteredData = responseData.filter(e => e.resource.resourceType == "QuestionnaireResponse");
    response = responseService.setDefaultResponse("QuestionnaireResponse", type, filteredData)
    console.info("responses: ============================>", filteredData)
    return response;
}



//  Get medication history data
let getMedicationHistoryData = async function (req, res) {
    try {
        const link = config.baseUrl + "QuestionnaireResponse"
        let specialOffset = null;
        const queryParams = req.query
        queryParams._total = "accurate";
        let resourceResult = []
        let resourceUrlData = { link: link, reqQuery: queryParams, allowNesting: 1, specialOffset: specialOffset }
        let questionnaireResponses = await fetchResource("QuestionnaireResponse", queryParams);
        let resStatus = 1;
        if(  questionnaireResponses.total == 0) {
                return res.status(200).json({ status: 2, message: "Data fetched", total: 0, data: []  })
        }
            
        resStatus = bundleStructure.setResponse(resourceUrlData, questionnaireResponses);
        const mainEncounterIds = questionnaireResponses.entry.map((e) => e.resource.encounter?.reference?.split("/")[1]).filter(Boolean).join(",");
        const mainEncounterList = await fetchResource("Encounter", { _id: mainEncounterIds, _count: req.query._count });
        const mainEncounters = mainEncounterList.entry.map((e) => e.resource);
        questionnaireResponses.entry.forEach(questionnaireResponse => {            
            const responseObj = getTransformedResult(QuestionnaireResponse, questionnaireResponse.resource);
            const primaryEncounter = mainEncounters.find((e) => e.id === questionnaireResponse.resource.encounter.reference.split("/")[1]);
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
    saveHistoryMedicationData, getMedicationHistoryData
}