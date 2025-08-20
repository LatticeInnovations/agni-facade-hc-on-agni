const { getPractitionerName } = require("../services/commonFunctions");
let ServiceRequest = require("../class/ServiceRequest")
const {buildFHIRResource, fetchResource, handleError, getTransformedResult} = require("../services/helperFunctions");
let axios = require("axios");
let config = require("../config/nodeConfig");
const bundleStructure = require("../services/bundleOperation")
const responseService = require("../services/responseService");
let {examinationSchema, examinationUpdateSchema} = require("../utils/Validator/examinationValidator");
const {validateRequest} = require("../utils/validateRequest");

const fetchMainEncounter = async (examData, token) => {
    const mainEncounter =   await fetchResource("Encounter", {
         appointment: examData.appointmentId,
         _count: 5000,
         _include: "Encounter:appointment",
     }, token);
 
     return mainEncounter
 }

//  save TestExam data
let saveExaminationData = async function (req, res) {    
    try {
        const validatedBody = validateRequest(req.body, examinationSchema, res);
        if (!validatedBody) return;
        req.queueMeta = {
            data: req.data,
            entity: "examination",
            requestType: "post",
            apiName: "add-examination",
            tokenData: req.decoded
          };
        const token = req.accessToken;
        let resourceResult = [];
        for (let examData of req.body) {
                const encounterData = await fetchMainEncounter(examData, token)
                const reqUuid = examData.uuid;
                const baseEncounterId = encounterData?.entry?.[0]?.resource?.id;
                if (!baseEncounterId) return;    
                // const existingResponse = await fetchResource("ServiceRequest", {category: "10825200", encounter: baseEncounterId, _total: "accurate"}, token);
                examData.activityList = examData.examinations.map(e => "ActivityDefinition/" + e)
                    const examinationResponseResource = buildFHIRResource(ServiceRequest, {...examData, categoryCode: "10825200", categoryDisplay: "Tests and examinations" ,encounterId: baseEncounterId, practitionerId: req.decoded.userId})
                    examinationResponseResource.uuid = reqUuid
                    const examinationResponseBundle =await  bundleStructure.setBundlePost(examinationResponseResource, examinationResponseResource.identifier, examData.uuid, "POST", "identifier")
                    resourceResult.push(examinationResponseBundle)
      
        }             
           
            let bundleData = await bundleStructure.getBundleJSON({resourceResult})  
                    // return res.status(201).json({ status: 1, message: "Examination data saved.", data: bundleData.bundle })
            let response = await axios.post(config.baseUrl, bundleData.bundle, {
                headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/fhir+json'
                        }
                    }); 
                    console.info("get bundle json response: ", response.status)  
            if (response.status == 200 || response.status == 201) {
                let responseData = setExamSaveResponse(bundleData.bundle.entry, response.data.entry, "post");   
                res.status(201).json({ status: 1, message: "Examination data saved.", data: responseData })
            }
            else {
                return res.status(500).json({  status: 0, message: "Unable to process. Please try again.", err: response  })
            }
    }
    catch (error) {
        console.error("saveTestExamData Error: ", error);
        error.code && error.code == "ERR" ? handleError(res, error, error.statusCode, error.message ) :  handleError(res, error)
    }

}

const updateExaminationData = async function (req, res) {    
    try {
        const validatedBody = validateRequest(req.body, examinationUpdateSchema, res);
        if (!validatedBody) return;
        req.queueMeta = {
            data: req.data,
            entity: "examination",
            requestType: "put",
            apiName: "update-examination",
            tokenData: req.decoded
          };
        const token = req.accessToken;
        let resourceResult = [];
        for (let examData of req.body) {
                const encounterData = await fetchMainEncounter(examData, token)
                const reqUuid = examData.uuid;
                const baseEncounterId = encounterData?.entry?.[0]?.resource?.id;
                if (!baseEncounterId) return;    
                const existingResponse = await fetchResource("ServiceRequest", {category: "10825200", encounter: baseEncounterId, _total: "accurate"}, token);
                examData.activityList = examData.examinations.map(e => "ActivityDefinition/" + e)
                    console.log("put case")
                    examData.uuid = existingResponse.entry[0].resource.identifier[0].value;
                    const examinationResponseResource = buildFHIRResource(ServiceRequest, {...examData, categoryCode: "10825200", categoryDisplay: "Tests and examinations" ,encounterId: baseEncounterId, practitionerId: req.decoded.userId})
                    examinationResponseResource.uuid = reqUuid
                    const examinationResponseBundle = await bundleStructure.setBundlePut(examinationResponseResource, null, existingResponse.entry[0].resource.id, "PUT", "identifier")
                    resourceResult.push(examinationResponseBundle)
        }             
           
            let bundleData = await bundleStructure.getBundleJSON({resourceResult})  
                    // return res.status(201).json({ status: 1, message: "Examination data saved.", data: bundleData.bundle })
            let response = await axios.post(config.baseUrl, bundleData.bundle, {
                headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/fhir+json'
                        }
                    }); 
                    console.info("get bundle json response: ", response.status)  
            if (response.status == 200 || response.status == 201) {
                let responseData = setExamSaveResponse(bundleData.bundle.entry, response.data.entry, "put");   
                res.status(201).json({ status: 1, message: "Examination data updated.", data: responseData })
            }
            else {
                return res.status(500).json({  status: 0, message: "Unable to process. Please try again.", err: response  })
            }
    }
    catch (error) {
        console.error("saveTestExamData Error: ", error);
        error.code && error.code == "ERR" ? handleError(res, error, error.statusCode, error.message ) :  handleError(res, error)
    }

}


const setExamSaveResponse  = (reqBundleData, responseBundleData, type) => {
    let filteredData = [];
       let response = [];
       const responseData = bundleStructure.mapBundleService(reqBundleData, responseBundleData)
       filteredData = responseData.filter(e => e.resource.resourceType == "ServiceRequest");
       response = responseService.setDefaultResponse("ServiceRequest", type, filteredData)
       console.info("responses: ============================>", filteredData)
       return response;
}

let getExaminationData = async function (req, res) {
    try {
        const token = req.accessToken;
        const link = config.baseUrl + "ServiceRequest";
        const queryParams = req.query
        queryParams.category = "10825200"
        queryParams._total = "accurate";
        let resourceResult = []
        let resourceUrlData = { link: link, reqQuery: queryParams, allowNesting: 0, specialOffset: 1 }
        let examinationResponses = await fetchResource("ServiceRequest", queryParams, token);
        let resStatus = 1;
        if(  examinationResponses.total == 0) {
                return res.status(200).json({ status: 2, message: "Data fetched", total: 0, data: []  })
        }
            
        resStatus = bundleStructure.setResponse(resourceUrlData, examinationResponses);
        const mainEncounterIds = examinationResponses.entry.map((e) => e.resource.encounter?.reference?.split("/")[1]).filter(Boolean).join(",");
        const mainEncounterList = await fetchResource("Encounter", { _id: mainEncounterIds, _count: req.query._count }, token);
        const mainEncounters = mainEncounterList.entry.map((e) => e.resource);
        const practitionerIds = examinationResponses.entry.map((e) => e.resource.author?.reference?.split("/")[1]).filter(Boolean).join(",");
        const practitionerList = await fetchResource("Practitioner", { _count: 10000, _id: practitionerIds }, token)
        examinationResponses.entry.forEach(examinationResponse => {            
            const responseObj = getTransformedResult(ServiceRequest, examinationResponse.resource);
            const primaryEncounter = mainEncounters.find((e) => e.id === examinationResponse.resource.encounter.reference.split("/")[1]);
            responseObj.practitionerName = getPractitionerName(responseObj.practitionerId, practitionerList.entry);
            responseObj.examinations = responseObj? responseObj.activityList : []
            delete responseObj["activityList"]
            responseObj.appointmentId = primaryEncounter?.appointment?.[0]?.reference?.split("/")[1] || null;
            responseObj.appointmentUuid = primaryEncounter?.identifier?.[0].value
            resourceResult.push(responseObj)
        });
        
        res.status(200).json({ status: resStatus, message: "Data fetched.", total: resourceResult.length,"offset": +queryParams?._offset, data: resourceResult  })
        
    }
    catch(error) {
        console.error("getTestExamData Error",error)
        return handleError(res, error);       
    }
}

module.exports = {
    saveExaminationData,
    getExaminationData,
    updateExaminationData
}