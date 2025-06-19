let axios = require("axios");
let ValueSet = require("../class/ValueSet");
let Condition = require('../class/Condition');
let Encounter = require('../class/encounter');
let Observation = require("../class/symptomObservation")
const bundleStructure = require("../services/bundleOperation");
const responseService = require("../services/responseService");
const { v4: uuidv4 } = require('uuid');
let config = require("../config/nodeConfig");
const diagnosisList = require("../utils/diagnosisList.json").compose.include[0].concept;
const symptomList = require("../utils/symptomsList.json").compose.include[0].concept;
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
            const link = config.baseUrl + "ValueSet";
            let resourceResult = [];

            let responseData = await bundleStructure.searchData(link, queryParams);
            console.info("responseData: ", responseData)
            let resStatus = 1;
            if( !responseData.data.entry || responseData.data.total == 0) {
                return res.status(200).json({ status: resStatus, message: "Data fetched", total: 0, data: []  })
            }
            const FHIRData = responseData.data.entry[0].resource;
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
            res.status(200).json({ status: resStatus, message: "Data fetched", total: resourceResult.length, data: resourceResult  })
    }
    catch (e) {
        console.error(e)
        return res.status(500).json({status: 0, message: "Unable to process. Please try again.", error: e})
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
                //  create sub encounter
                let subEncounter = new Encounter({ 
                    id: symDiagData.symDiagUuid,  encounterId: mainEncounter.id, patientId: patientId,
                    vitalUuid: symDiagData.symDiagUuid, practitionerId: req.decoded.userId, createdOn: symDiagData.createdOn,
                    orgId: req.decoded.orgId
                }, {}).getUserInputToFhirForVitals();
                subEncounter.identifier[0].system = "https://hl7.org/fhir/sid/sn/diagnosis"
                subEncounter.type =  [
                    {
                        "coding": [
                            {
                                "system": "https://your-custom-coding-system",
                                "code": "symptom-diagnosis-encounter",
                                "display": "Symptom Diagnosis encounter"
                            }
                        ]
                    }
                ]
               
                let subEncounterBundle = await bundleStructure.setBundlePost(subEncounter, null, subEncounter.id, "POST", "identifier");
                resourceResult.push(subEncounterBundle)
                // create symptom Observation  
                if(symDiagData.symptoms.length > 0) {
                    let observationId =  uuidv4()             
                let symptomResource = new Observation({patientId: patientId, encounterId: symDiagData.symDiagUuid,
                    practitionerId: req.decoded.userId, symptoms: symDiagData.symptoms, uuid: observationId, newEnc: true
                }, {}).setJsonTOFhir()
                let symptomBundle = await bundleStructure.setBundlePost(symptomResource, null, observationId, "POST", "identifier");                
                resourceResult.push(symptomBundle)
                }               

                // create condition resources
                symDiagData.diagnosis.forEach(async (element)=> {
                    symDiagData.uuid = uuidv4();
                    symDiagData.encounterId = symDiagData.symDiagUuid;
                    symDiagData.patientId =patientId;
                    symDiagData.practitionerId = req.decoded.userId;
                    symDiagData.onsetDateTime = symDiagData.createdOn;
                    symDiagData.diagnosis = element;
                    const conditionResource = new Condition(symDiagData, {}).getJsonToFhirTranslator();
                    const conditionResourcePost = await bundleStructure.setBundlePost(conditionResource, null, symDiagData.uuid, "POST", "identifier");
                    resourceResult.push(conditionResourcePost)
                })                 
        }
        console.info("=============>", resourceResult, "<=========================");
        let bundleData = await bundleStructure.getBundleJSON({resourceResult})  
        console.info("main bundle transaction resource: ", bundleData)
        let response = await axios.post(config.baseUrl, bundleData.bundle); 
        console.log("get bundle json response: ", response.status)  
        if (response.status == 200 || response.status == 201) {
            let responseData = setSymptomDiagnosisResponse(bundleData.bundle.entry, response.data.entry, "post");
            res.status(201).json({ status: 1, message: "Symptom and diagnosis data saved.", data: responseData })
        }
        else {
                return res.status(500).json({status: 0, message: "Unable to process. Please try again.", error: response})
        }

    }
    catch (e) {
        return res.status(500).json({status: 0, message: "Unable to process. Please try again.", error: e})
    }

}

const getSymptomDiagnosisData    = async function(req, res) {
    try {
            let queryParams = {
                _total : "accurate",
                _count: req.query._count,
                _offset: req.query._offset,
                _sort: req.query._sort
            }
            queryParams._include= "Encounter:part-of:Encounter";
            queryParams.type="symptom-diagnosis-encounter"
            queryParams["service-provider"] = req.decoded.orgId
            const link = config.baseUrl + "Encounter";
            let resourceResult = [];
            let resourceUrlData = { link: link, reqQuery: queryParams, allowNesting: 0, specialOffset: null }
            let responseData = await bundleStructure.searchData(link, queryParams);
            console.info("responseData: ", responseData)
            let resStatus = 1;
            if( !responseData.data.entry || responseData.data.total == 0) {
                return res.status(200).json({ status: resStatus, message: "Data fetched", total: 0, data: []  })
            }
        const FHIRData =  responseData.data.entry 
        let mainEncounterList = FHIRData.filter(e => e.resource.resourceType == "Encounter" && e.resource.appointment).map(e => e.resource);
        let subEncounterList = FHIRData.filter(e => e.resource.resourceType == "Encounter" && e.resource.type && e.resource.type[0].coding[0].code == "symptom-diagnosis-encounter").map(e => e.resource);
        
        let subEncounterIds = subEncounterList.map((e) => e.id).join(',');
        let symptoms = await bundleStructure.searchData(config.baseUrl + "Observation", { "encounter": subEncounterIds, _count: 5000 });
        symptoms = symptoms?.data?.entry || [];

        let diagnosis = await bundleStructure.searchData(config.baseUrl + "Condition", { "encounter": subEncounterIds, _count: 5000 });
        diagnosis = diagnosis?.data?.entry || [];
        
        const practitonerIdList = subEncounterList.map(e=> e.participant[0].individual.reference.split("/")[1]).join(",")
        let practitionerData = await bundleStructure.searchData(config.baseUrl + "Practitioner", { _id: practitonerIdList, _count: 100000 });
        practitionerData = practitionerData.data.entry;
        for(let encounter of subEncounterList){
                let diagnosisList = [];
                const mainEncounter = mainEncounterList.filter(e => e.id = encounter.partOf.reference.split("/")[1])[0]
                const symptomObservation = symptoms.filter(e => e.resource.resourceType == "Observation" && e.resource.encounter.reference.split("/")[1] == encounter.id)
                const diagnosisResources = diagnosis.filter(e => e.resource.resourceType == "Condition" && e.resource.encounter.reference.split("/")[1] == encounter.id).map(e => e.resource)
                if(diagnosisResources.length > 0)
                    diagnosisList = diagnosisResources.map(element => {
                    const data = new Condition({}, element).getFHIRToUserResponse()                    
                    return data
                })
                let symptomResource = []
                if(symptomObservation.length > 0) {
                    symptomResource = new Observation({}, symptomObservation[0].resource).getFhirToJson()
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
        resStatus = bundleStructure.setResponse(resourceUrlData, responseData);
        res.status(200).json({ status: resStatus, message: "Data fetched", total: resourceResult.length, data: resourceResult  })
    } 
    catch(e) {
        console.error("Error: ", e)
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

const patchSymptomDiagnosisData = async (req, res) => {
    try {
        // let response = resourceValid(req.params);
        // if (response.error) {
        //     console.error(response.error.details)
        //     let errData = { status: 0, response: { data: response.error.details }, message: "Invalid input" }
        //     return res.status(422).json(errData);
        // }
        const reqInput = req.body;
        let resourceResult = [];
        console.log("Symptom and Diagnosis Patch");
        const allSymptomEncounterIds = reqInput.map(e=> e.symDiagFhirId).join(",")
        let allResources = await bundleStructure.searchData(config.baseUrl + "Encounter", {"_revinclude:0": "Condition:encounter", "_revinclude:1": "Observation:encounter", "_id": allSymptomEncounterIds, _count: 2000})
        const subEncounterResources = allResources.data.entry.filter(e => e.resource.resourceType == "Encounter").map(e => e.resource)
        allResources = allResources.data.entry
        for(let symDiagData of reqInput) {                
            const subEncounter = subEncounterResources.filter(e => e.id == symDiagData.symDiagFhirId)[0];
            let subEncounterData = new Encounter({}, subEncounter).patchSystemDiagnosisSubEncounter();
            const subEncounterPatch = await bundleStructure.setBundlePut(subEncounterData, subEncounterData.indentifier, subEncounter.id, "PUT");  
            resourceResult.push(subEncounterPatch)
            const patientId = subEncounter.subject.reference.split("/")[1]
            const observationResource = allResources.filter(e => e.resource.resourceType == "Observation" && e.resource.encounter.reference.split("/")[1] == symDiagData.symDiagFhirId)
             
            symDiagData.patientId = patientId
            symDiagData.encounterId = symDiagData.symDiagFhirId
            symDiagData.practitionerId = req.decoded.userId
            symDiagData.newEnc = false;
            symDiagData.onsetDateTime = symDiagData.createdOn;
            // observation patch logic
            const symptomBundle = await observationResourcePatch(observationResource, symDiagData);
            if(Object.keys(symptomBundle).length > 0)
                resourceResult.push(symptomBundle)
            //  diagnosis resources logic
            const conditionResources = allResources.filter(e => e.resource.resourceType == "Condition" && e.resource.encounter.reference.split("/")[1] == symDiagData.symDiagFhirId).map(e => e.resource)
            const conditionBundle = await conditionResourcePatch(conditionResources, symDiagData, req.token);
            if(conditionBundle.length > 0) {
                resourceResult = [...resourceResult, ...conditionBundle]
            }                    
        }
      console.info(resourceResult)
      const resourceData = {resourceResult: resourceResult, errData: []}
      let bundleData = await bundleStructure.getBundleJSON(resourceData)  
      console.info(bundleData)
      let response = await axios.post(config.baseUrl, bundleData.bundle); 
      console.log("get bundle json response: ", response.status)  
      if (response.status == 200 || response.status == 201) {
          let resourceResponse = setSymptomDiagnosisResponse(bundleData.bundle.entry, response.data.entry, "patch");
          let responseData = [...resourceResponse, ...bundleData.errData];
          res.status(201).json({ status: 1, message: "Symptom and diagnosis data saved.", data: responseData })
      }
      else {
          return res.status(500).json({
          status: 0, message: "Unable to process. Please try again.", error: response
          })
      }
    }  catch(e) {
              console.error("Error",e)
              return res.status(200).json({
                      status: 0,
                      message: "Unable to process. Please try again"
                  }) 
    }
}


const observationResourcePatch = async function(observationResource, symDiagData, token) {
    try {
        //  If symptoms do not exist create resource from symptoms list
    let symptomBundle = {}
    const observationId =  uuidv4()
    symDiagData.uuid = observationId
    if(observationResource.length == 0 && symDiagData.symptoms.length > 0) {
        let symptomResource = new Observation(symDiagData, {}).setJsonTOFhir();
        symptomBundle = await bundleStructure.setBundlePost(symptomResource, symptomResource.identifier, observationId, "POST", "identifier", token);                
    }
    //  If symptoms resource exist but symptoms list is empty
    else if(observationResource.length > 0 && symDiagData.symptoms.length  == 0){
       symptomBundle = await bundleStructure.setBundleDelete("Observation", observationResource[0].resource.id);       
    }
    // update existing symptom resource
    else if(symDiagData.symptoms.length > 0 ){
        let symptomResource = new Observation(symDiagData, {}).setJsonTOFhir();
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
                const conditionResource = new Condition(symDiagData, {}).getJsonToFhirTranslator();
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