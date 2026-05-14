let axios = require("axios");
let CodeSystem = require("../class/ValueSet");
let Condition = require('../class/Condition');
let Encounter = require('../class/SymDiagnosisEncounter');
let Observation = require("../class/symptomObservation")
const bundleStructure = require("../services/bundleOperation");
const responseService = require("../services/responseService");
const { v4: uuidv4 } = require('uuid');
let config = require("../config/nodeConfig");
const diagnosisList = require("../utils/diagnosisList.json").concept;
const {buildFHIRResource, fetchResource, handleError, getTransformedResult, getAPIPath} = require("../services/helperFunctions");
const { symDiagSaveArraySchema, symDiagPatchArraySchema } = require("../utils/Validator/symDxValidator");
const {validateRequest} = require("../utils/validateRequest");
const { saveToken } = require("../services/email/tokenStore");
const { publishReportJob } = require("../middleware/reportPublisher");


global.diagnosisMap = new Map();
global.symptomsMap = new Map();

const populateSymptomMap = (symptomList) => {
    console.info("symptoms map populated");
    symptomList.forEach((e) => {
        if(!global.symptomsMap.has(e.code)){
            global.symptomsMap.set(e.code, e.display);
        }
    });
}

const populateDiagnosisMap = (diagnosisList) => {
    console.info("Diagnosis map populated");
    diagnosisList.forEach((e) => {
        if(!global.diagnosisMap.has(e.code)){
            global.diagnosisMap.set(e.code, e.display);
        }
    });
}

// populateSymptomMap(symptomList);
 populateDiagnosisMap(diagnosisList);

const getSymptomsDiagnosisList = async function (req, res) {
    try {
            let queryParams = req.query;
            let resourceResult = [];
            const token = req.accessToken;
            let responseData = await fetchResource("CodeSystem", queryParams, token);
            console.info("responseData: ", responseData)
            let resStatus = 1;
            if( !responseData.entry || responseData.total == 0) {
                return res.status(200).json({ status: resStatus, message: "Data fetched", total: 0, data: []  })
            }
            const FHIRData = responseData.entry[0].resource;
            let list = FHIRData.concept;
            const type = req.query.name == "symptomsList" ? "symptoms" : "diagnosis";
            if(type == "symptoms" && list.length != global.symptomsMap.size){
                populateSymptomMap(list);
            }
            else if(type == "diagnosis" && list.length != global.diagnosisMap.size){
                populateDiagnosisMap(diagnosisList);
            }
            let valueSet = new CodeSystem({}, FHIRData, type);            
            resourceResult = valueSet.getFHIRToJSONOutput();
            return res.status(200).json({ status: resStatus, message: "Data fetched", total: resourceResult.length, data: type == "symptoms"? resourceResult.symptoms : resourceResult.diagnosis  })
    }
    catch (error) {
        console.error(error)
        return handleError(res, error);
    }

}

const createEncounterBundle = async(mainEncounter, symDiagData, patientId, token, type, encounterType) => {
    try {
        // const encounterUuid = uuidv4();
        const oldUuid = symDiagData.oldUuid;
        const encounter = buildFHIRResource(Encounter, { 
            uuid: symDiagData.uuid,  encounterId: mainEncounter.id, patientId: patientId, progressNote: symDiagData.progressNote,
            practitionerId: token.userId, generatedOn: symDiagData.appUpdatedDate, appointmentId: symDiagData.appointmentId,
            type: encounterType
        });
        console.log("main encounter: ", mainEncounter.serviceProvider, "----")
        console.log("sub encounter: ", encounter)
        encounter.uuid = oldUuid
        encounter.location = mainEncounter?.location || null;
        encounter.individual = mainEncounter.individual;
        encounter.serviceProvider = mainEncounter?.serviceProvider || null;
        encounter.participant = mainEncounter?.participant || null;

        if(type == "POST") {
            return await bundleStructure.setBundlePost(encounter, null, symDiagData.uuid, "POST", "identifier");
        }
        else {
            return await bundleStructure.setBundlePut(encounter, null, symDiagData.fhirId, "PUT", "identifier");
        }
               
       
    }
    catch (error) {
        console.error(`createEncounterBundle Error:`, error.message);
        throw error;
    }
}



const createDiagnosisBundle = async (patientId, symDiagData, token, encounterId, type) => {
    try {
        const resourceResult = []
        symDiagData.diagnosis.forEach(async (element)=> {
            let conditionResourceBundle = null
            symDiagData.encounterId = symDiagData.fhirId ?"Encounter/" + encounterId : (type == "POST" ? "urn:uuid:" +  encounterId : "Encounter/" + encounterId)  
            symDiagData.uuid = uuidv4();            
            symDiagData.patientId =patientId;
            symDiagData.practitionerId = token.userId;
            symDiagData.onsetDateTime = symDiagData.appUpdatedDate;
            symDiagData.diagnosis = element;
            const conditionResource = buildFHIRResource(Condition, symDiagData);
            conditionResource.uuid = symDiagData.uuid;
            if(type == "POST") {
                conditionResourceBundle = await bundleStructure.setBundlePost(conditionResource, null, symDiagData.uuid, "POST", "identifier");
            }
            else {
                conditionResourceBundle = await bundleStructure.setBundlePut(conditionResource, null, symDiagData.fhirId, "PUT", "identifier");
            }
            resourceResult.push(conditionResourceBundle)
        })  
        return resourceResult;
    }   
    catch (error) {
        console.error(`createSymptomBundle Error:`, error.message);
        throw error;
    }
}

const fetchDiagnosisEncounter = async (baseEncounterId, token, subEncounterType) => {
    const result =  await fetchResource("Encounter", {  "part-of": baseEncounterId, type: subEncounterType, _total: "accurate"}, token);
    return result;
 }

 function applyNonCampaignSideEffects(req) {
    req.queueMeta = {
        data: req.body,
        entity: "diagnosis",
        requestType: "post",
        apiName: "save-diagnosis",
        tokenData: req.decoded
      };
}


const saveSymptomDiagnosisData = async function (req, res) {
    try {

        const isCampaignPath = await getAPIPath(req);
        console.log("check is it campaign path: ", isCampaignPath)

        const validatedBody = validateRequest(req.body, symDiagSaveArraySchema, res);
        if (!validatedBody) return;

        if (!isCampaignPath) applyNonCampaignSideEffects(req);

        const token = req.accessToken;
        const mainEncounterType = isCampaignPath ? "screening-site-main-encounter" : "facility-main-encounter";
        const subEncounterType = isCampaignPath ? "screening-site-symptom-diagnosis-encounter" : "symptom-diagnosis-encounter";
        let resourceResult = [];
        const appointmentIds = req.body.map(e=> e.appointmentId).join(",");
        // fetch main encounter using appointment id
            const getMainEncounters = await fetchResource("Encounter", { "appointment": appointmentIds, _count: 5000, type:  mainEncounterType}, token);
            if(!getMainEncounters.entry) {
                return []
            }
            const mainEncounters = getMainEncounters.entry.map(e => e.resource);
            for(let diagData of req.body) {
                let symDiagData = {
                    ...diagData,
                    diagnosis: [...(diagData.diagnosis || [])]
                  };
                let subEncounterBundle = null;
                let diagnosisResult = null
                let mainEncounter = mainEncounters.filter(e => e.appointment[0]?.reference?.split('/')[1] == symDiagData.appointmentId)
                console.log("Diagnosis POST");
                mainEncounter = mainEncounter[0]
                const diagnosisEncounter = await fetchDiagnosisEncounter(mainEncounter.id, token, subEncounterType)
                const patientId = mainEncounter.subject.reference.split("/")[1];
                symDiagData.oldUuid = symDiagData.uuid
                if (diagnosisEncounter.total > 0 && diagnosisEncounter.entry) {
                    console.log("put case")
                    let diagnosisList = await fetchResource("Condition", { "encounter": diagnosisEncounter.entry[0].resource.id, _count: 5000 }, token);
                    diagnosisList = diagnosisList?.entry || [];
                     symDiagData.fhirId = diagnosisEncounter?.entry?.[0]?.resource.id;
                     symDiagData.uuid = diagnosisEncounter?.entry?.[0]?.resource.identifier[0].value
                     subEncounterBundle = await createEncounterBundle(mainEncounter, symDiagData, patientId, req.token, "PUT", subEncounterType)
                     diagnosisResult = await handleUpdateDiagnosisList(diagnosisList, symDiagData, patientId, req.token, symDiagData.fhirId)
                }
                else {                   
                    subEncounterBundle = await createEncounterBundle(mainEncounter, symDiagData, patientId, req.token, "POST", subEncounterType)
                // create condition resources
                    diagnosisResult = await createDiagnosisBundle(patientId, symDiagData, req.token, symDiagData.uuid, "POST");  
                }
                
                resourceResult.push(subEncounterBundle, ...diagnosisResult)
            }

        let bundleData = await bundleStructure.getBundleJSON({resourceResult})  
        console.info("main bundle transaction resource: ", bundleData)
        // return res.status(201).json({ status: 1, message: "Symptom and diagnosis data saved.", data: bundleData.bundle })
        let response = await axios.post(config.baseUrl, bundleData.bundle, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/fhir+json'
            }
        });  
        if (response.status == 200 || response.status == 201) {
            let responseData = setSymptomDiagnosisResponse(bundleData.bundle.entry, response.data.entry, "post", subEncounterType);
            const fhirIds = responseData.map(item => item.fhirId);
            const patientIds = [...new Set(req.body.map(cvd => cvd.patientId))];
            await saveToken(token);
            for (const patientId of patientIds) {
                await publishReportJob(patientId, fhirIds);
            }
            return res.status(201).json({ status: 1, message: "Symptom and diagnosis data saved.", data: responseData })
        }
        else {
            return handleError(res, response);           
        }

    }
    catch(error) {
        console.error("saveSymptomDiagnosisData Error: ", error)
        return handleError(res, error)
    }

}

const deleteConditionResources = async (ids) => {
    const bundlesList = []
    ids.forEach(async (id) => {
        const deletedResource = await bundleStructure.setBundleDelete("Condition", id);
        bundlesList.push(deletedResource)
    })
   return bundlesList;           
}

const handleUpdateDiagnosisList = async (diagnosisResources, symDiagData, patientId, token, encounterId) => {
    let conditionResources = []
    const diagnosisList = diagnosisResources.map(element => {
        return  getTransformedResult(Condition, element.resource);
    }).map(element => element.code)
    const removed = diagnosisList.filter(item => !symDiagData.diagnosis.includes(item)); // present in arr1 but not in arr2
    const added = symDiagData.diagnosis.filter(item => !diagnosisList.includes(item));   // present in arr2 but not in arr1
    symDiagData.diagnosis = added
    const newDiagnosisBundles = await createDiagnosisBundle(patientId, symDiagData, token, encounterId, "POST");
    const idsToDelete = diagnosisResources.filter(cond => removed.includes(cond.resource.code?.coding?.[0]?.code))
        .map(cond => cond.resource.id);
    const deletedResources = await deleteConditionResources(idsToDelete)
    conditionResources = [...newDiagnosisBundles, ...deletedResources]
    return conditionResources;
}

const getSymDiagForEncounter = async(mainEncounterList, subEncounterList, symptoms, practitionerData, token, isCampaignPath) => {
    try {
        const resourceResult = [];

        for(let encounter of subEncounterList){
            let diagnosisList = [];
            const mainEncounter = mainEncounterList.filter(e => e.id == encounter.partOf.reference.split("/")[1])[0]
            let diagnosis = await fetchResource("Condition", { "encounter": encounter.id, _count: 5000 }, token);
        diagnosis = diagnosis?.entry || [];
            const diagnosisResources = diagnosis.filter(e => e.resource.resourceType == "Condition" && e.resource.encounter.reference.split("/")[1] == encounter.id).map(e => e.resource)
            if(diagnosisResources.length > 0)
                diagnosisList = diagnosisResources.map(element => {
                return  getTransformedResult(Condition, element);
            })
                   
            let practitioner = practitionerData.filter((e) => e?.resource?.id == encounter?.participant[0].individual.reference.split("/")[1]);
            let practitionerName = practitioner.length > 0 ? (practitioner?.[0]?.resource?.name?.[0]?.given?.join(' ') || '') + ' ' + (practitioner?.[0]?.resource?.name?.[0]?.family || "") : "";
             let subEncounter = {
                patientId: encounter?.subject?.reference?.split('/')?.[1] || null,
                fhirId: encounter.id,
                uuid: encounter.identifier[0].value,
                appointmentId: mainEncounter.appointment[0].reference.split("/")[1],
                appointmentUuid: mainEncounter.identifier[0].value,
                symptoms: [],
                progressNote: encounter?.extension?.[0]?.valueAnnotation?.text || null,
                createdOn: encounter.period.start,
                diagnosis: diagnosisList,
                practitionerId: practitioner?.[0]?.resource?.id || null,
                practitionerName: practitionerName.trim(),
                campaignId : isCampaignPath ? (encounter?.location?.[0]?.location?.reference.split("/")[1] ) : null
            }
            resourceResult.push(subEncounter)
        }
        return resourceResult;
    }
    catch(error) {
        console.error("getSymDiagForEncounter Error: ", error);
        throw error
    }
}

const getSymptomDiagnosisData = async function(req, res) {
    try {
        const isCampaignPath = await getAPIPath(req);
        console.log("check is it campaign path: ", isCampaignPath);
        const encounter_code = isCampaignPath ? "screening-site-symptom-diagnosis-encounter" : "symptom-diagnosis-encounter";
        const queryParams = {
                _total : "accurate",
                _count: req.query._count,
                _offset: req.query._offset,
                _sort: req.query._sort,
                type: encounter_code,
                _lastUpdated: req.query._lastUpdated
        };
        const token = req.accessToken;
        let resourceUrlData = { link: config.baseUrl + "Encounter", reqQuery: queryParams, allowNesting: 0, specialOffset: 1 }
        let responseData = await fetchResource("Encounter", queryParams, token);
        console.info("responseData: ", responseData)
        let resStatus = 1;
        if( !responseData.entry || responseData.total == 0) {
                return res.status(200).json({ status: 2, message: "Data fetched", total: 0, data: []  })
        }
        const FHIRData =  responseData.entry 
        const mainEncounterIds = responseData.entry.map(e=> e.resource.partOf.reference.split("/")[1]).join(",");
        let mainEncounterList = await fetchResource("Encounter", {_count: 1000, "_id": mainEncounterIds}, token)
        mainEncounterList = mainEncounterList.entry.map(e => e.resource);
        let subEncounterList = FHIRData.filter(e => e.resource.resourceType == "Encounter" && e.resource.type && e.resource.type[0].coding[0].code == encounter_code).map(e => e.resource);
        
        // let subEncounterIds = subEncounterList.map((e) => e.id).join(',');
        let symptoms =  [];

        
        
        const practitionerIdList = subEncounterList.map(e=> e.participant[0].individual.reference.split("/")[1]).join(",")
        let practitionerData = await fetchResource("Practitioner", { _id: practitionerIdList, _count: 100000 }, token);
        practitionerData = practitionerData.entry;

        const resourceResult = await getSymDiagForEncounter(mainEncounterList, subEncounterList, symptoms,  practitionerData, token, isCampaignPath);
  
        resStatus = bundleStructure.setResponse(resourceUrlData, responseData);
        res.status(200).json({ status: resStatus, message: "Data fetched", total: resourceResult.length, data: resourceResult  })
    } 
    catch(error) {
        console.error("getSymptomDiagnosisData Error: ", error)
        return handleError(res, error)
    }
}



const setSymptomDiagnosisResponse  = (reqBundleData, responseBundleData, type, subEncounterType) => {
   let filteredData = [];
       let response = [];
       const responseData = bundleStructure.mapAssessmentBundleService(reqBundleData, responseBundleData)
       if(["post", "POST", "put", "PUT"].includes(type)){
           filteredData = responseData.filter(e => e.resource && e.resource.resourceType == "Encounter" && e.resource?.type?.[0]?.coding?.[0]?.code == subEncounterType);
       }
 
       response = responseService.setDefaultAssessmentResponse("Encounter", type, filteredData)
       return response;
}

const patchEncounterBundle = async (subEncounterResources, symDiagData) => {
    try {
        const subEncounter = subEncounterResources.filter(e => e.id == symDiagData.symDiagFhirId)[0];
            let subEncounterData = new Encounter({}, subEncounter).patchSystemDiagnosisSubEncounter();
            return await bundleStructure.setBundlePut(subEncounterData, subEncounterData.identifier, subEncounter.id, "PUT");  
    }
    catch(error) {
        console.error("patchEncounterBundle Error: ", error)
        throw error;
    }
}

const createPatchArray = async (reqInput, subEncounterResources, allResources, token) => {
    try {
        const resourceResult = []
        for(let symDiagData of reqInput) {                
            const subEncounterPatch = await patchEncounterBundle(subEncounterResources, symDiagData)
            resourceResult.push(subEncounterPatch)
            const patientId = subEncounterPatch.resource.subject.reference.split("/")[1]
            symDiagData.patientId = patientId;
            const observationResource = allResources.filter(e => e.resource.resourceType == "Observation" && e.resource.encounter.reference.split("/")[1] == symDiagData.symDiagFhirId);  
            const newSymDiagData = {...symDiagData, patientId, encounterId: symDiagData.symDiagFhirId, practitionerId: token.userId,  newEnc: false,  onsetDateTime: symDiagData.createdOn };           
            // observation patch logic
            const symptomBundle = await observationResourcePatch(observationResource, newSymDiagData);
            if(Object.keys(symptomBundle).length > 0)
                resourceResult.push(symptomBundle)
            //  diagnosis resources logic
            
            const conditionResources = allResources.filter(e => e.resource.resourceType == "Condition" && e.resource.encounter.reference.split("/")[1] == symDiagData.symDiagFhirId).map(e => e.resource)
            const conditionBundle = await conditionResourcePatch(conditionResources, symDiagData, token);
            if(conditionBundle.length > 0) {
                resourceResult.push(conditionBundle);
            }                    
        }
        return resourceResult;
    }
    catch(error) {
        console.error("createPatchArray Error: ", error)
        throw error;
    } 
}
const patchSymptomDiagnosisData = async (req, res) => {
    try {
        const validatedBody = validateRequest(req.body, symDiagPatchArraySchema, res);
        if (!validatedBody) return;  
        const token = req.accessToken;
        console.log("Symptom and Diagnosis Patch");
        const allSymptomEncounterIds = req.body.map(e=> e.symDiagFhirId).join(",");
        let allResources = await fetchResource("Encounter", {"_revinclude:0": "Condition:encounter", "_revinclude:1": "Observation:encounter", "_id": allSymptomEncounterIds, _count: 2000}, token)
        allResources = allResources.entry;
        const subEncounterResources = allResources.filter(e => e.resource.resourceType == "Encounter").map(e => e.resource)
        const resourceResult = await createPatchArray(req.body, subEncounterResources, allResources, req.token)
        console.info(resourceResult)
        const resourceData = {resourceResult: resourceResult, errData: []}
        let bundleData = await bundleStructure.getBundleJSON(resourceData)  
        console.info(bundleData)
        // return res.status(200).json({ status: 1, message: "Symptom and diagnosis data saved.", data: bundleData.bundle })
        let response = await axios.post(config.baseUrl, bundleData.bundle, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/fhir+json'
            }
        }); 
        if (response.status == 200 || response.status == 201) {
            let resourceResponse = setSymptomDiagnosisResponse(bundleData.bundle.entry, response.data.entry, "patch");
            let responseData = [...resourceResponse, ...bundleData.errData];
            res.status(201).json({ status: 1, message: "Symptom and diagnosis data saved.", data: responseData })
        }
        else {
            return handleError(res, response) 
        }
    }  catch(error) {
        console.error("patchSymptomDiagnosisData Error: ", error)
        return handleError(res, error) 
    }
}


const observationResourcePatch = async function(observationResource, symDiagData, token) {
    try {
        //  If symptoms do not exist create resource from symptoms list
    let symptomBundle = {}
    const observationId =  uuidv4()
    symDiagData.uuid = observationId
    if(observationResource.length == 0 && symDiagData.symptoms.length > 0) {
        let symptomResource = buildFHIRResource(Observation, symDiagData);
        symptomBundle = await bundleStructure.setBundlePost(symptomResource, symptomResource.identifier, observationId, "POST", "identifier", token);                
    }
    //  If symptoms resource exist but symptoms list is empty
    else if(observationResource.length > 0 && symDiagData.symptoms.length  == 0){
       symptomBundle = await bundleStructure.setBundleDelete("Observation", observationResource[0].resource.id);       
    }
    // update existing symptom resource
    else if(symDiagData.symptoms.length > 0 ){
        let symptomResource =  buildFHIRResource(Observation, symDiagData);
        observationResource[0].resource.component = symptomResource.component
        symptomBundle = await bundleStructure.setBundlePost(observationResource[0].resource, null, observationResource[0].resource.id, "PUT", null);  
        
    }
    return symptomBundle
    }catch(e) {
        return Promise.reject(e)
    }
    
}

const conditionResourcePatch = async function(conditionResources, symDiagData, token) {
    try {
        let conditionResourcesList = [], newConditions = [], deleteConditions = [];
        const existingCodes = conditionResources.map(item => item.code.coding[0].code)
        //  find resources not having new code and create resource
        newConditions = symDiagData.diagnosis.filter(item => !existingCodes.includes(item))
        // find resources that existed but now needs to be deleted
        deleteConditions = conditionResources.filter(item => !symDiagData.diagnosis.includes(item.code.coding[0].code)).map(e => ({id: e.id, code: e.code.coding[0].code}))
        // check if conditionResources list is empty
        if(newConditions.length > 0 ) {
             // create condition resource
             newConditions.forEach(async (element)=> {
                symDiagData.uuid = uuidv4();
                symDiagData.encounterId = symDiagData.symDiagFhirId;
                symDiagData.practitionerId = token.userId;
                symDiagData.onsetDateTime = symDiagData.createdOn;
                symDiagData.diagnosis = element;
                const conditionResource =  buildFHIRResource(Condition, symDiagData);
                const conditionResourcePost = await bundleStructure.setBundlePost(conditionResource, null, symDiagData.uuid, "POST", "identifier");
                conditionResourcesList.push(conditionResourcePost)
            }) 
        }
        if(deleteConditions.length > 0) {
            deleteConditions.forEach(async (element) => {
                let deleteCondition = await bundleStructure.setBundleDelete("Condition", element.id);
                conditionResourcesList.push(deleteCondition)
            })                
        }
        return conditionResourcesList;
    }
    catch(e) {
        return Promise.reject(e);
    }
}

module.exports = { saveSymptomDiagnosisData, getSymptomDiagnosisData, patchSymptomDiagnosisData, getSymptomsDiagnosisList }