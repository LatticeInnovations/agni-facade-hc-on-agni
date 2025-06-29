let axios = require("axios");
let ValueSet = require("../class/ValueSet");
let Condition = require('../class/Condition');
let Encounter = require('../class/SymDiagnosisEncounter');
let Observation = require("../class/symptomObservation")
const bundleStructure = require("../services/bundleOperation");
const responseService = require("../services/responseService");
const { v4: uuidv4 } = require('uuid');
let config = require("../config/nodeConfig");
const diagnosisList = require("../utils/diagnosisList.json").compose.include[0].concept;
const symptomList = require("../utils/symptomsList.json").compose.include[0].concept;
const {buildFHIRResource, fetchResource, handleError, getTransformedResult} = require("../services/helperFunctions");


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

populateSymptomMap(symptomList);
populateDiagnosisMap(diagnosisList);

const getSymptomsDiagnosisList = async function (req, res) {
    try {
            let queryParams = req.query;
            let resourceResult = [];

            let responseData = await fetchResource("ValueSet", queryParams);
            console.info("responseData: ", responseData)
            let resStatus = 1;
            if( !responseData.entry || responseData.total == 0) {
                return res.status(200).json({ status: resStatus, message: "Data fetched", total: 0, data: []  })
            }
            const FHIRData = responseData.entry[0].resource;
            let list = FHIRData.compose.include[0].concept;
            const type = req.query.name == "symptomsList" ? "symptoms" : "diagnosis";
            if(type == "symptoms" && list.length != global.symptomsMap.size){
                populateSymptomMap(list);
            }
            else if(type == "diagnosis" && list.length != global.diagnosisMap.size){
                populateDiagnosisMap(diagnosisList);
            }
            let valueSet = new ValueSet({}, FHIRData, type);            
            resourceResult = valueSet.getFHIRToJSONOutput();
            return res.status(200).json({ status: resStatus, message: "Data fetched", total: resourceResult.length, data: resourceResult  })
    }
    catch (error) {
        console.error(error)
        return handleError(res, error);
    }

}

const createEncounterBundle = async(mainEncounter, symDiagData, patientId, token) => {
    try {
        // const encounterUuid = uuidv4();
        console.log(symDiagData)
        const encounter = buildFHIRResource(Encounter, { 
            id: symDiagData.symDiagUuid,  encounterId: mainEncounter.id, patientId: patientId,
            vitalUuid: symDiagData.symDiagUuid, practitionerId: token.userId, generatedOn: symDiagData.createdOn,
            orgId: token.orgId
        });
               
        return await bundleStructure.setBundlePost(encounter, null, symDiagData.symDiagUuid, "POST", "identifier");
    }
    catch (error) {
        console.error(`createEncounterBundle Error:`, error.message);
        throw error;
    }
}

const createSymptomBundle = async (patientId, symDiagData, token) => {
    try {
        const resourceResult = []
        if(symDiagData.symptoms.length > 0) {
            let observationId =  uuidv4()             
        let symptomResource = buildFHIRResource(Observation, {patientId: patientId, encounterId: symDiagData.symDiagUuid,
            practitionerId: token.userId, symptoms: symDiagData.symptoms, uuid: observationId, newEnc: true
        })
           let symptomBundle = await bundleStructure.setBundlePost(symptomResource, null, observationId, "POST", "identifier");                
        resourceResult.push(symptomBundle)
        }
        return resourceResult;
    }   
    catch (error) {
        console.error(`createSymptomBundle Error:`, error.message);
        throw error;
    }
}

const createDiagnosisBundle = async (patientId, symDiagData, token) => {
    try {
        const resourceResult = []
        symDiagData.diagnosis.forEach(async (element)=> {
            symDiagData.uuid = uuidv4();
            symDiagData.encounterId = symDiagData.symDiagUuid;
            symDiagData.patientId =patientId;
            symDiagData.practitionerId = token.userId;
            symDiagData.onsetDateTime = symDiagData.createdOn;
            symDiagData.diagnosis = element;
            const conditionResource = buildFHIRResource(Condition, symDiagData);
            const conditionResourcePost = await bundleStructure.setBundlePost(conditionResource, null, symDiagData.uuid, "POST", "identifier");
            resourceResult.push(conditionResourcePost)
        })  
        return resourceResult;
    }   
    catch (error) {
        console.error(`createSymptomBundle Error:`, error.message);
        throw error;
    }
}

const saveSymptomDiagnosisData = async function (req, res) {
    try {
        let resourceResult = [];
        const appointmentIds = req.body.map(e=> e.appointmentId).join(",");
        // fetch main encounter using appointment id
            const getMainEncounters = await bundleStructure.searchData(config.baseUrl + "Encounter", { "appointment": appointmentIds, _count: 5000 , "_include": "Encounter:appointment" });
            if(getMainEncounters.data.entry.length == 0) {
                return []
            }
            const mainEncounters = getMainEncounters.data.entry.map(e => e.resource)
            
            for(let symDiagData of req.body) {
                let mainEncounter = mainEncounters.filter(e => e.resourceType == "Encounter" && e.appointment[0]?.reference?.split('/')[1] == symDiagData.appointmentId)
                console.log("Symptom and Diagnosis POST");
                mainEncounter = mainEncounter[0]
                const patientId = mainEncounter.subject.reference.split("/")[1];
                const subEncounterBundle = await createEncounterBundle(mainEncounter, symDiagData, patientId, req.token)
                // create symptom Observation  
                const symptomResult = await createSymptomBundle(patientId, symDiagData, req.token)
                // create condition resources
                const diagnosisResult = await createDiagnosisBundle(patientId, symDiagData, req.token);  
                resourceResult = [subEncounterBundle, ...symptomResult, ...diagnosisResult] 
        }
        console.info("=============>", resourceResult, "<=========================");
        let bundleData = await bundleStructure.getBundleJSON({resourceResult})  
        console.info("main bundle transaction resource: ", bundleData)
        // return res.status(201).json({ status: 1, message: "Symptom and diagnosis data saved.", data: bundleData.bundle })
        let response = await axios.post(config.baseUrl, bundleData.bundle); 
        console.log("get bundle json response: ", response.status)  
        if (response.status == 200 || response.status == 201) {
            let responseData = setSymptomDiagnosisResponse(bundleData.bundle.entry, response.data.entry, "post");
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

const getSymDiagForEncounter = async(mainEncounterList, subEncounterList, symptoms, diagnosis, practitionerData) => {
    try {
        const resourceResult = [];

        for(let encounter of subEncounterList){
            let diagnosisList = [];
            const mainEncounter = mainEncounterList.filter(e => e.id == encounter.partOf.reference.split("/")[1])[0]
            console.log("mainEncounter: ", mainEncounter, encounter.partOf.reference)
            const symptomObservation = symptoms.filter(e => e.resource.resourceType == "Observation" && e.resource.encounter.reference.split("/")[1] == encounter.id)
            const diagnosisResources = diagnosis.filter(e => e.resource.resourceType == "Condition" && e.resource.encounter.reference.split("/")[1] == encounter.id).map(e => e.resource)
            if(diagnosisResources.length > 0)
                diagnosisList = diagnosisResources.map(element => {
                return  getTransformedResult(Condition, element);
            })
            let symptomResource = []
            if(symptomObservation.length > 0) {
                symptomResource = getTransformedResult(Observation, symptomObservation[0].resource);
            }                     
            let practitioner = practitionerData.filter((e) => e?.resource?.id == encounter?.participant[0].individual.reference.split("/")[1]);
            let practitionerName = practitioner.length > 0 ? (practitioner?.[0]?.resource?.name?.[0]?.given?.join(' ') || '') + ' ' + (practitioner?.[0]?.resource?.name?.[0]?.family || "") : "";
             let subEncounter = {
                patientId: encounter?.subject?.reference?.split('/')?.[1] || null,
                symDiagFhirId: encounter.id,
                symDiagUuid: encounter.identifier[0].value,
                appointmentId: mainEncounter.appointment[0].reference.split("/")[1]  ,
                appointmentUuid: mainEncounter.identifier[0].value,
                symptoms: symptomResource?.symptoms || [],
                createdOn: encounter.period.start,
                diagnosis: diagnosisList,
                practitionerName: practitionerName.trim()
            }
            console.log(subEncounter)
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
        const queryParams = {
                _total : "accurate",
                _count: req.query._count,
                _offset: req.query._offset,
                _sort: req.query._sort,
                type: "symptom-diagnosis-encounter",
                "service-provider": req.decoded.orgId
        };
        let resourceUrlData = { link: config.baseUrl + "Encounter", reqQuery: queryParams, allowNesting: 0, specialOffset: 1 }
        let responseData = await fetchResource("Encounter", queryParams);
        console.info("responseData: ", responseData)
        let resStatus = 1;
        if( !responseData.entry || responseData.total == 0) {
                return res.status(200).json({ status: resStatus, message: "Data fetched", total: 0, data: []  })
        }
        const FHIRData =  responseData.entry 
        const mainEncounterIds = responseData.entry.map(e=> e.resource.partOf.reference.split("/")[1]).join(",");
        let mainEncounterList = await fetchResource("Encounter", {_count: 1000, "_id": mainEncounterIds})
        console.log("mainEncounterIds: ", mainEncounterList)
        mainEncounterList = mainEncounterList.entry.map(e => e.resource);
        console.log("mainEncounterList: ", mainEncounterList)
        let subEncounterList = FHIRData.filter(e => e.resource.resourceType == "Encounter" && e.resource.type && e.resource.type[0].coding[0].code == "symptom-diagnosis-encounter").map(e => e.resource);
        
        let subEncounterIds = subEncounterList.map((e) => e.id).join(',');
        let symptoms = await fetchResource("Observation", { "encounter": subEncounterIds, _count: 5000 });
        symptoms = symptoms?.entry || [];

        let diagnosis = await fetchResource("Condition", { "encounter": subEncounterIds, _count: 5000 });
        diagnosis = diagnosis?.entry || [];
        
        const practitionerIdList = subEncounterList.map(e=> e.participant[0].individual.reference.split("/")[1]).join(",")
        let practitionerData = await fetchResource("Practitioner", { _id: practitionerIdList, _count: 100000 });
        practitionerData = practitionerData.entry;

        const resourceResult = await getSymDiagForEncounter(mainEncounterList, subEncounterList, symptoms, diagnosis, practitionerData);
  
        resStatus = bundleStructure.setResponse(resourceUrlData, responseData);
        res.status(200).json({ status: resStatus, message: "Data fetched", total: resourceResult.length, data: resourceResult  })
    } 
    catch(error) {
        console.error("getSymptomDiagnosisData Error: ", error)
        return handleError(res, error)
    }
}


const setSymptomDiagnosisResponse  = (reqBundleData, responseBundleData, type) => {
    let filteredData = [];
    let response = [];
    const responseData = bundleStructure.mapBundleService(reqBundleData, responseBundleData)
    if(["post", "POST"].includes(type)) {
        filteredData = responseData.filter(e => e.resource.resourceType == "Encounter" && e.resource?.type?.[0]?.coding?.[0]?.code == "symptom-diagnosis-encounter");
    }
    else if(["patch", "PATCH"].includes(type)) {
        console.log("check --> ", responseData)
        filteredData = responseData.filter(e => e.resource && e.resource.resourceType == "Encounter");
    }

    response = responseService.setDefaultResponse("Encounter", type, filteredData);
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
        // let response = resourceValid(req.params);
        // if (response.error) {
        //     console.error(response.error.details)
        //     let errData = { status: 0, response: { data: response.error.details }, message: "Invalid input" }
        //     return res.status(422).json(errData);
        // }   
        console.log("Symptom and Diagnosis Patch");
        const allSymptomEncounterIds = req.body.map(e=> e.symDiagFhirId).join(",");
        console.log("allSymptomEncounterIds: ", allSymptomEncounterIds)
        let allResources = await fetchResource("Encounter", {"_revinclude:0": "Condition:encounter", "_revinclude:1": "Observation:encounter", "_id": allSymptomEncounterIds, _count: 2000})
        allResources = allResources.entry;
        console.log("Symptom and Diagnosis Patch", allResources);
        const subEncounterResources = allResources.filter(e => e.resource.resourceType == "Encounter").map(e => e.resource)
        const resourceResult = await createPatchArray(req.body, subEncounterResources, allResources, req.token)
        console.info(resourceResult)
        const resourceData = {resourceResult: resourceResult, errData: []}
        let bundleData = await bundleStructure.getBundleJSON(resourceData)  
        console.info(bundleData)
        // return res.status(200).json({ status: 1, message: "Symptom and diagnosis data saved.", data: bundleData.bundle })
        let response = await axios.post(config.baseUrl, bundleData.bundle); 
        console.log("get bundle json response: ", response.status)  
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
        console.log(symptomResource, observationResource)
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
        console.log("existingCodes: ", existingCodes)
        //  find resources not having new code and create resource
        newConditions = symDiagData.diagnosis.filter(item => !existingCodes.includes(item))
        console.log("newConditions: ", newConditions)
        // find resources that existed but now needs to be deleted
        deleteConditions = conditionResources.filter(item => !symDiagData.diagnosis.includes(item.code.coding[0].code)).map(e => ({id: e.id, code: e.code.coding[0].code}))
        console.log("deleteConditions: ", deleteConditions)
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
        console.log(conditionResourcesList)
        return conditionResourcesList;
    }
    catch(e) {
        return Promise.reject(e);
    }
}

module.exports = { saveSymptomDiagnosisData, getSymptomDiagnosisData, patchSymptomDiagnosisData, getSymptomsDiagnosisList }