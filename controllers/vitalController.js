let axios = require("axios");
const Observation = require("../class/Observation");
const Encounter = require("../class/VitalEncounter");
const bundleStructure = require("../services/bundleOperation");
const responseService = require("../services/responseService");
const { v4: uuidv4 } = require('uuid');
let config = require("../config/nodeConfig");
const resourceType = "Observation"
let setVitalData = async function (req, res) {
    try {
        let resourceResult = [];
        for(let vital of req.body){ 
            let encounterData = await bundleStructure.searchData(config.baseUrl + "Encounter", { "appointment": vital.appointmentId, _count: 5000 , "_include": "Encounter:appointment" });
            let encounterUuid = uuidv4();
            let encounter = new Encounter({ 
                id: encounterUuid,
                encounterId: encounterData.data.entry[0].resource.id,
                patientId: vital.patientId,
                vitalUuid: vital.vitalUuid,
                practitionerId: req.decoded.userId,
                createdOn: vital.createdOn,
                orgId: req.decoded.orgId
            }, {}).getUserInputToFhirForVitals();
            vital.encounterId = encounterUuid;
            vital.practitionerId = req.decoded.userId;
            let heightObservation = new Observation(vital, {}).getUserInputToFhirHeight();
            let weightObservation = new Observation(vital, {}).getUserInputToFhirWeight();
            let heartRateObservation = new Observation(vital, {}).getUserInputToFhirHeartRate();
            let respRateObservation = new Observation(vital, {}).getUserInputToFhirRespRate();
            let spo2Observation = new Observation(vital, {}).getUserInputToFhirSpo2();
            let temperatureObservation = new Observation(vital, {}).getUserInputToFhirTemp();
            let bpObservation = new Observation(vital, {}).getUserInputToFhirBloodPressure();
            let bloodGlucoseObservation = new Observation(vital, {}).getUserInputToFhirBloodGlucose();
            let eyeTestObservation = new Observation(vital, {}).getUserInputToFhirEyeTest();
            let cholesterolObservation = new Observation(vital, {}).getUserInputToFhirCholesterol();
            heightObservation.id = uuidv4();
            weightObservation.id = uuidv4();
            heartRateObservation.id = uuidv4();
            respRateObservation.id = uuidv4();
            spo2Observation.id = uuidv4();
            temperatureObservation.id = uuidv4();
            bpObservation.id = uuidv4();
            bloodGlucoseObservation.id = uuidv4();
            eyeTestObservation.id = uuidv4();
            cholesterolObservation.id = uuidv4();
            
            let encounterBundle = await bundleStructure.setBundlePost(encounter, null, encounter.id, "POST", "identifier");
            heightObservation = await bundleStructure.setBundlePost(heightObservation, null, heightObservation.id, "POST", "identifier");
            weightObservation = await bundleStructure.setBundlePost(weightObservation, null, weightObservation.id, "POST", "identifier");
            heartRateObservation = await bundleStructure.setBundlePost(heartRateObservation, null, heartRateObservation.id, "POST", "identifier");
            respRateObservation = await bundleStructure.setBundlePost(respRateObservation, null, respRateObservation.id, "POST", "identifier");
            spo2Observation = await bundleStructure.setBundlePost(spo2Observation, null, spo2Observation.id, "POST", "identifier");
            temperatureObservation = await bundleStructure.setBundlePost(temperatureObservation, null, temperatureObservation.id, "POST", "identifier");
            bpObservation = await bundleStructure.setBundlePost(bpObservation, null, bpObservation.id, "POST", "identifier");
            bloodGlucoseObservation = await bundleStructure.setBundlePost(bloodGlucoseObservation, null, bloodGlucoseObservation.id, "POST", "identifier");
            eyeTestObservation = await bundleStructure.setBundlePost(eyeTestObservation, null, eyeTestObservation.id, "POST", "identifier");
            cholesterolObservation = await bundleStructure.setBundlePost(cholesterolObservation, null,cholesterolObservation.id, "POST", "identifier");
            resourceResult.push(encounterBundle, heightObservation, weightObservation, heartRateObservation, respRateObservation, spo2Observation, temperatureObservation, bpObservation, bloodGlucoseObservation, eyeTestObservation, cholesterolObservation);
        }
        console.info("=============>", resourceResult, "<=========================");
        let bundleData = await bundleStructure.getBundleJSON({resourceResult})  
        console.info("main bundle transaction resource: ", bundleData)
        let response = await axios.post(config.baseUrl, bundleData.bundle); 
        console.log("get bundle json response: ", response.status)  
        if (response.status == 200 || response.status == 201) {
            let responseData = setVitalResponse(bundleData.bundle.entry, response.data.entry, "post");
            res.status(201).json({ status: 1, message: "Vital saved.", data: responseData })
        }
        else {
                return res.status(500).json({status: 0, message: "Unable to process. Please try again.", error: response})
        }

    }
    catch (e) {
        return res.status(500).json({status: 0, message: "Unable to process. Please try again.", error: e})
    }

}

const getVitalData = async function(req, res) {
    try {
            let queryParams = {
                _total : "accurate",
                _count: req.query._count,
                _offset: req.query._offset,
                _sort: req.query._sort
            }
            queryParams.type="vital-encounter";
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
            console.log("Vitals Get API");
            let practitionerData = await bundleStructure.searchData(config.baseUrl + "Practitioner", { _count: 10000 });
            practitionerData = practitionerData.data.entry;
            // Fetch main Encounters list
            let mainEncounterList = responseData.data.entry.filter(e => e.resource.resourceType == "Encounter" && e.resource.type[0].coding[0].code == "vital-encounter").map(e => e.resource.partOf.reference.split('/')[1]);
            let mainEncounterIds = mainEncounterList.join(','); 
            
            mainEncounterList = await bundleStructure.searchData(config.baseUrl + "Encounter", { _id: mainEncounterIds, _count: 10000 });
            mainEncounterList = mainEncounterList.data.entry.map(e => e.resource);
            // Fetch sub encounter of vitals i.e Encounter --> Observation
            let vitalEncounterList = responseData.data.entry.filter(e => e.resource.type && e.resource.type[0].coding[0].code == "vital-encounter").map(e => e.resource);
            let vitalEncounterIds = vitalEncounterList.map(e => e.id).join(',');
            let allObservations = await bundleStructure.searchData(config.baseUrl + "Observation", { encounter: vitalEncounterIds, _count: 100000 });
            allObservations = allObservations.data.entry.map(e => e.resource);
            for(let encounter of vitalEncounterList){
                    let observationEncounter = new Encounter({}, encounter);
                    observationEncounter.getFhirToJsonForVitals();
                    let observationData = observationEncounter.getEncounterResource();
                    let practitioner = practitionerData.filter((e) => e?.resource?.id === observationData?.practitionerId);
                    let practitionerName = practitioner.length > 0 ? (practitioner?.[0]?.resource?.name?.[0]?.given?.join(' ') || '') + ' ' + (practitioner?.[0]?.resource?.name?.[0]?.family || "") : "";
                    observationData.practitionerName = practitionerName.trim();
                    // Date of vital creation
                    observationData.createdOn = encounter.period.start;
                    let primaryEncounter = mainEncounterList.filter(e => e.id === observationData.primaryEncounterId);
                    // console.log("primary encounter --->", primaryEncounter)
                    console.log("primary encounter ids---->", observationData.primaryEncounterId)
                    if(primaryEncounter.length > 0){
                        // fetch appointment id from main encounter
                        observationData.appointmentId = primaryEncounter?.[0].appointment?.[0]?.reference?.split("/")[1] || null;
                    }
                    delete observationData.primaryEncounterId;
                    delete observationData.practitionerId;
                    // let observationList = FHIRData.filter(e => e.resource.resourceType == "Observation" && e.resource.encounter.reference == "Encounter/"+encounter.id).map(e => e.resource);
                    let observationList = allObservations.filter(e => e.encounter.reference == "Encounter/"+encounter.id); 
                    // console.log(observationList.filter(data => data.subject.reference === 'Patient/3741'));
                    for(let observation of observationList){
                        let data = getObservationData(observation, observationData);
                        observationData = { ...observationData, ...data}
                    }
                    console.info("======================>", observationData)
                    resourceResult.push(observationData);
        } 
        resStatus = bundleStructure.setResponse(resourceUrlData, responseData);
        res.status(200).json({ status: resStatus, message: "Data fetched", total: resourceResult.length, data: resourceResult  })
    } 
    catch(e) {
        console.error("Error: ", e)
    }
}

const getObservationData = (FHIRData, observation) => {
    switch(FHIRData.code.text){
        case 'Height': return new Observation(observation, FHIRData).getHeightData();
        case 'Weight': return new Observation(observation, FHIRData).getWeightData();
        case 'Heart Rate': return new Observation(observation, FHIRData).getHeartRate();
        case 'Respiratory rate': return new Observation(observation, FHIRData).getRespRate();
        case 'spO2': return new Observation(observation, FHIRData).getSpo2();
        case 'Body temperature': return new Observation(observation, FHIRData).getTemperature();
        case 'Blood Pressure': return new Observation(observation, FHIRData).getBloodPressure();
        case 'Blood Glucose': return new Observation(observation, FHIRData).getBloodGlucose();
        case 'Eye Test': return new Observation(observation, FHIRData).getEyeTest();
        case 'Cholesterol': return new Observation(observation, FHIRData).getCholesterolData();
    }
}


const setVitalResponse  = (reqBundleData, responseBundleData, type) => {
    let filteredData = [];
    let response = [];
    const responseData = bundleStructure.mapBundleService(reqBundleData, responseBundleData)
    if(["post", "POST"].includes(type)){
        filteredData = responseData.filter(e => e.resource.resourceType == "Encounter" && e.resource?.type?.[0]?.coding?.[0]?.code == "vital-encounter");
    }
    else if(["patch", "PATCH"].includes(type)){
        filteredData = responseData.filter(e => e.fullUrl.split("/")[0] == "Encounter");
    }
    console.info("filtered data", filteredData)
    response = responseService.setDefaultResponse(resourceType, type, filteredData);

    return response;
}

module.exports = { setVitalData, getVitalData }