
let Questionnaire = require("../class/TobaccoCessationQuestionnaire");
let QuestionnaireResponse = require("../class/TobaccoCessationQuestionnaireResponse")
let axios = require("axios");
let config = require("../config/nodeConfig");
const { v4: uuidv4 } = require('uuid');
const bundleStructure = require("../services/bundleOperation")
const responseService = require("../services/responseService");
const { fetchResource, buildFHIRResource, getTransformedResult, getAPIPath } = require("../services/helperFunctions");
const { tobaccoSchema } = require("../utils/Validator/tobaccoValidator");
const {validateRequest} = require("../utils/validateRequest");
const { getPractitionerName } = require("../services/commonFunctions");
const { publishReportJob } = require("../middleware/reportPublisher");
const { saveToken } = require("../services/email/tokenStore");


const fetchMainEncounter = async (tobaccoData, token) => {
    const mainEncounter =   await fetchResource("Encounter", {
         appointment: tobaccoData.appointmentId,
         _count: 5000,
         _include: "Encounter:appointment",
     }, token);
 
     return mainEncounter
 }

 function applyNonCampaignSideEffects(req) {
    req.queueMeta = {
        data: req.body,
        entity: "tobaccoCessation",
        requestType: "post",
        apiName: "save-tobacco-cessation",
        tokenData: req.decoded
      };
}
 
 

//  Save tobacco cessation data
let saveTobaccoData = async function (req, res) {
    try {

        const isCampaignPath = await getAPIPath(req);
        console.log("check is it campaign path: ", isCampaignPath)

        const validatedBody = validateRequest(req.body, tobaccoSchema, res);
        if (!validatedBody) return;

        if (!isCampaignPath) applyNonCampaignSideEffects(req);

        const token = req.accessToken;
        let resourceResult = [];
        let questionnaireId = null;
        let questionnaireReference = null;
        const questionnaireName = isCampaignPath ? "screening-site-tobacco-cessation-questionnaire" : "tobacco-cessation-questionnaire";
        //  Get Questionnaire id if it not exists create it and pass as reference for uuid
        const questionnaireResource = await fetchResource("Questionnaire", { name: questionnaireName, _total: "accurate", _count: 1}, token)
        console.log("questionnaireResource: ", questionnaireResource)
        if(questionnaireResource.total > 0 && questionnaireResource.entry) {
            questionnaireId = questionnaireResource.entry[0].resource.id;
            questionnaireReference = "Questionnaire/" + questionnaireId;        
        }            
        else {
           questionnaireId = uuidv4(); 
           questionnaireReference = "urn:uuid:" + questionnaireId
           const questionnaireResourceBuilt = buildFHIRResource(Questionnaire, {questionnaireId, questionnaireName});
           const questionnaireBundle = await bundleStructure.setBundlePost(questionnaireResourceBuilt, questionnaireResourceBuilt.identifier, questionnaireId, "POST", "identifier")
           resourceResult.push(questionnaireBundle);
        }
        for (let tobaccoData of req.body) {
            //  fetch appointment encounter
            const encounterData = await fetchMainEncounter(tobaccoData, token)
            const reqUuid = tobaccoData.uuid;
            const baseEncounterId = encounterData?.entry?.[0]?.resource?.id;
            if (!baseEncounterId) return;
            console.log("questionnaireId: ", questionnaireId, "patient id: ", tobaccoData.patientId, " baseEncounterId: ", baseEncounterId)
            const existingResponse = await fetchResource("QuestionnaireResponse", {source: tobaccoData.patientId, encounter: baseEncounterId, questionnaire: questionnaireId, _total: "accurate"}, token);
            console.log("questionnaireId: ", questionnaireId, "patient id: ", tobaccoData.patientId, " baseEncounterId: ", baseEncounterId, " existing response: ", existingResponse.total, existingResponse.entry)
            if (existingResponse.total > 0 && existingResponse.entry) {
                console.log("put case")
                tobaccoData.uuid = existingResponse.entry[0].resource.identifier.value;
                const questionnaireResponseResource = buildFHIRResource(QuestionnaireResponse, {...tobaccoData, questionnaireId: questionnaireReference, encounterId: baseEncounterId, practitionerId: req.decoded.userId})
                questionnaireResponseResource.uuid = reqUuid
                const questionnaireResponseBundle = await bundleStructure.setBundlePut(questionnaireResponseResource, null, existingResponse.entry[0].resource.id, "PUT", "identifier")
                resourceResult.push(questionnaireResponseBundle)
                }
            else {
                console.log("Check the post case", questionnaireReference)
                const questionnaireResponseResource = buildFHIRResource(QuestionnaireResponse, {...tobaccoData, questionnaireId: questionnaireReference, encounterId: baseEncounterId, practitionerId: req.decoded.userId})
                questionnaireResponseResource.uuid = reqUuid
                const questionnaireResponseBundle =await  bundleStructure.setBundlePost(questionnaireResponseResource,[questionnaireResponseResource.identifier], tobaccoData.uuid, "POST", "identifier")
                resourceResult.push(questionnaireResponseBundle)
            }
           
       }
        let bundleData = await bundleStructure.getBundleJSON({resourceResult})  
        // return res.status(201).json({ status: 1, message: "tobacco cessation data saved.", data: bundleData.bundle })
        let response = await axios.post(config.baseUrl, bundleData.bundle, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/fhir+json'
            }
        }); 
        console.info("get bundle json response: ", response.status)  
        if (response.status == 200 || response.status == 201) {
            let responseData = setSaveResponse(bundleData.bundle.entry, response.data.entry, "post");   
            res.status(201).json({ status: 1, message: "Tobacco cessation data saved.", data: responseData })
            
            const fhirIds = responseData.map(item => item.fhirId);

            const patientIds = [...new Set(req.body.map(cvd => cvd.patientId))];
            await saveToken(token);
            for (const patientId of patientIds) {
                await publishReportJob(patientId, fhirIds);
            }
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
    // console.info("responses: ============================>", filteredData)
    return response;
}



//  Get tobacco cessation data
let getTobaccoData = async function (req, res) {
    try {

        const isCampaignPath = await getAPIPath(req);
        console.log("check is it campaign path: ", isCampaignPath)
        const questionnaireName = isCampaignPath ? "screening-site-tobacco-cessation-questionnaire" : "tobacco-cessation-questionnaire";
        const token = req.accessToken;
        const questionnaireResource = await fetchResource("Questionnaire", {name: questionnaireName, _total: "accurate", _count: 1}, token)
        if(questionnaireResource.total == 0) {
            return res.status(200).json({ status: 2, message: "Data fetched", total: 0, data: []  })
        } 
        const link = config.baseUrl + "QuestionnaireResponse"
        let specialOffset = 1;
        const queryParams = req.query
        queryParams._total = "accurate";
        queryParams.questionnaire = "Questionnaire/" + questionnaireResource.entry[0].resource.id
        let resourceResult = []
        let resourceUrlData = { link: link, reqQuery: queryParams, allowNesting: 0, specialOffset: specialOffset }
        let questionnaireResponses = await fetchResource("QuestionnaireResponse", queryParams, token);
        let resStatus = 1;
        if(  questionnaireResponses.total == 0) {
                return res.status(200).json({ status: 2, message: "Data fetched", total: 0, data: []  })
        }
            
        resStatus = bundleStructure.setResponse(resourceUrlData, questionnaireResponses);
        const mainEncounterIds = questionnaireResponses.entry.map((e) => e.resource.encounter?.reference?.split("/")[1]).filter(Boolean).join(",");
        const mainEncounterList = await fetchResource("Encounter", { _id: mainEncounterIds, _count: req.query._count }, token);
        const mainEncounters = mainEncounterList.entry.map((e) => e.resource);
        const practitionerIds = questionnaireResponses.entry.map((e) => e.resource.author?.reference?.split("/")[1]).filter(Boolean).join(",");
        const practitionerList = await fetchResource("Practitioner", { _count: 10000, _id: practitionerIds }, token)
        questionnaireResponses.entry.forEach(questionnaireResponse => {            
            const responseObj = getTransformedResult(QuestionnaireResponse, questionnaireResponse.resource);
            const primaryEncounter = mainEncounters.find((e) => e.id === questionnaireResponse.resource.encounter.reference.split("/")[1]);
            responseObj.practitionerId = responseObj.practitionerId;
            responseObj.practitionerName = getPractitionerName(responseObj.practitionerId, practitionerList.entry);
            responseObj.appointmentId = primaryEncounter?.appointment?.[0]?.reference?.split("/")[1] || null;
            responseObj.appointmentUuid = primaryEncounter?.identifier?.[0].value;
            responseObj.campaignId = isCampaignPath ? primaryEncounter.location[0].location.reference.split("/")[1] : null;
            resourceResult.push(responseObj)
        });
        resStatus = bundleStructure.setResponse(resourceUrlData, questionnaireResponses);
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
    saveTobaccoData, getTobaccoData
}