const { fetchResource,  getTransformedResult, fetchMainResourcesParallel, fetchInBatches } = require("../services/helperFunctions");

const classification = require("../services/dashboardClassification");
let Patient = require("../class/patient");

// constants
const MAIN_ENCOUNTER_TYPE = "facility-main-encounter";
const TOTAL_COUNT = 3;
const BATCH_SIZE = 50;
const CVD_ENCOUNTER_TYPE = "cvd-encounter";
const VITAL_ENCOUNTER_TYPE = "vital-test-encounter"
const CVD_OBS_CODES = {
    "35094-2": "bp",
    "9156-5": "bmi",
    "72166-2": "smoking",
    "2093-3":  "cholesterol",
    "72333-9": "risk"
};

const VITAL_OBS_CODES = {
    "36048009": "bloodGlucose" // confirm this is your blood glucose code
}

const CVD_FIELDS = ["bp", "bmi", "smoker", "screeningDate", "cholesterol", "cholesterolUnit", "risk"];
const VITAL_FIELDS = ["glucose", "glucoseUnit", "glucoseType"];

const facilityMainEncounterQuery = (queryParams) => {
return {
            type: MAIN_ENCOUNTER_TYPE,
            "service-provider": queryParams.facilityIds,
            "status": "finished,in-progress",
            "appointment.slot.start:0": `ge${queryParams.startDate}`,
            "appointment.slot.start:1": `le${queryParams.endDate}`,
            "_total": "accurate",
            "_count": TOTAL_COUNT,
            "_offset" : 0
        };
}

const groupEncountersByPatient = (patientMap, encounters, type) => {
    console.log(encounters)
        if (!encounters || !encounters.entry) return;
        encounters.entry.forEach(entry => {
            const resource = entry.resource;
            const encounterId = resource.id;
            const patientId = resource.subject.reference.split("/")[1];
            console.log("patientId: ", patientId)
            if (!patientMap[patientId]) {
                
                 patientMap[patientId] = {
                    mainEncounters: []
                };
            }

             patientMap[patientId][type].push({encounterId, facilityId: resource.serviceProvider.reference.split("/")[1]});
        });
        console.log("patientMap 0: ", patientMap["368"].mainEncounters[0])
        return patientMap;
}

const getSubEncounterLookup = (subEcnounters) => {
    const subEncounterLookup = {}
    subEcnounters.forEach(e => {
        const subId = e.resource.id;
        const mainId = e.resource.partOf?.reference?.split("/")[1];
        if(mainId) {
            subEncounterLookup[subId] = {mainEncounterId: mainId, resource: e.resource}
        }
    });
    return subEncounterLookup;
}



const mapCvdObservationsToEncounter = (observations, subEncounterLookup, patientMap) => {
    observations.forEach(e => {
        const observation = e.resource;
        const subEncounterId = observation.encounter?.reference?.split("/")[1];
        const mainId = subEncounterLookup[subEncounterId].mainEncounterId
        const patientId = observation.subject?.reference?.split("/")[1]
        if(!mainId) return;
        const encounterEntry = patientMap[patientId].mainEncounters.find(enc => enc.encounterId == mainId)
        if(!encounterEntry) return;

        if(!encounterEntry.cvd)
            encounterEntry.cvd = {
                bp: null, bmi: null,
                smoker: null, screeningDate: null,
                cholesterol: null, cholesterolUnit: null,
                risk: null
        };

        fetchCvdObservationValue(encounterEntry, observation, subEncounterLookup[subEncounterId].resource);
    });
}

const fetchCvdObservationValue = (encounterEntry, obs, subEncounter) => {
    const code = obs.code?.coding?.[0]?.code;
    const field = CVD_OBS_CODES[code];
     if (!field) return;

     if (field === "bp") {
        const systolic  = obs.component?.find(c => c.code?.coding?.[0]?.code === "8480-6")?.valueQuantity?.value;
        const diastolic = obs.component?.find(c => c.code?.coding?.[0]?.code === "8462-4")?.valueQuantity?.value;
        encounterEntry.cvd.sysBP = systolic ? `${systolic}` : obs.valueQuantity?.value ?? null;
        encounterEntry.cvd.diaBP = diastolic ? `${diastolic}` : obs.valueQuantity?.value ?? null;
     }
      else if (field === "smoking") {
        encounterEntry.cvd.smoker = obs.valueCodeableConcept?.coding?.[0]?.code ?? obs.valueString ?? 0;
    }
    else if (field === "cholesterol") {
        encounterEntry.cvd.cholesterol = obs.component?.[0]?.valueQuantity?.value ?? null;
        encounterEntry.cvd.cholesterolUnit =obs.component?.[0]?.valueQuantity?.unit ?? null;
    }
    else if (field === "bmi") {
        encounterEntry.cvd.bmi = obs.component?.[0]?.valueQuantity?.value ?? null;
    }
    else if (field === "risk") {
        encounterEntry.cvd.cvdRisk = obs.component?.[0]?.valueQuantity?.value ?? null;
    }
    encounterEntry.cvd.screeningDate = subEncounter.extension?.[0]?.valueDateTime || null
}

const mapVitalObservationsToEncounter = (observations, subEncounterLookup, patientMap) => {
    observations.forEach(e => {
        const observation = e.resource;
        const subEncounterId = observation.encounter?.reference?.split("/")[1];
        const mainId = subEncounterLookup[subEncounterId].mainEncounterId;
        const patientId = observation.subject?.reference?.split("/")[1];
        if (!mainId) return;

        const encounterEntry = patientMap[patientId]?.mainEncounters
            .find(enc => enc.encounterId == mainId);
        if (!encounterEntry) return;

        if (!encounterEntry.vitals) encounterEntry.vitals = {
            glucose: null,
            glucoseUnit: null,
            glucoseType: null
        };

        const code = observation.code?.coding?.[0]?.code;
        const field = VITAL_OBS_CODES[code];
        if (!field || !observation.component) return;
        encounterEntry.vitals.glucose = observation.component?.[0]?.valueQuantity?.value ?? null;
        encounterEntry.vitals.glucoseUnit = observation.component?.[0]?.valueQuantity?.unit ?? null;
        encounterEntry.vitals.glucoseType = observation?.code?.coding?.[0].display ?? null;
    });
}



const fetchVitalData = async (mainEncounterIds, patientMap, token) => {
    try {
  
        await fetchInBatches(mainEncounterIds, BATCH_SIZE, async(batchIds) => {
            const response = await fetchResource("Observation", {
                "encounter.type": VITAL_ENCOUNTER_TYPE,
                "encounter.part-of": batchIds.join(","),
                "code": Object.keys(VITAL_OBS_CODES).join(","),
                "_include": "Observation:encounter",
                "_count": (BATCH_SIZE * 20) + batchIds.length
            }, token);

            if (!response?.entry?.length) return;

            // Separate observations and included sub-encounters by search.mode
            const observations = response.entry.filter(e => e.search?.mode == "match");
            const subEncounters = response.entry.filter(e => e.search?.mode == "include");
            console.log("check observations: ", observations)
            // Build sub encounter to main encounter lookup
            const subEncounterLookup = getSubEncounterLookup(subEncounters);
            // map to correct CVD obseravation in main
            mapVitalObservationsToEncounter(observations, subEncounterLookup, patientMap)
        
        });

        return patientMap; 

    }
    catch(error) {
        console.error("fetchCvdSubEncounters error: ", error);
        return Promise.reject(error)
    }
}



const fetchCvdData = async (mainEncounterIds, patientMap, token) => {
    try {
  
        await fetchInBatches(mainEncounterIds, BATCH_SIZE, async(batchIds) => {
            const response = await fetchResource("Observation", {
                "encounter.type": CVD_ENCOUNTER_TYPE,
                "encounter.part-of": batchIds.join(","),
                "code": Object.keys(CVD_OBS_CODES).join(","),
                "_include": "Observation:encounter",
                "_count": (BATCH_SIZE * 20) + batchIds.length
            }, token);

            if (!response?.entry?.length) return;

            // Separate observations and included sub-encounters by search.mode
            const observations = response.entry.filter(e => e.search?.mode == "match");
            const subEncounters = response.entry.filter(e => e.search?.mode == "include");

            // Build sub encounter to main encounter lookup
            const subEncounterLookup = getSubEncounterLookup(subEncounters);
            // map to correct CVD obseravation in main
            mapCvdObservationsToEncounter(observations, subEncounterLookup, patientMap)
        
        });

        return patientMap; 

    }
    catch(error) {
        console.error("fetchCvdSubEncounters error: ", error);
        return Promise.reject(error)
    }
}

const filterPatientsWithData = (patientMap) => {
            return Object.fromEntries(
                Object.entries(patientMap).filter(([patientId, patient]) =>
                    patient.mainEncounters.some(enc => enc.cvd || enc.vitals)
                )
            );
        };


const filterFinalData = (finalData) => {
    return Object.fromEntries(
        Object.entries(finalData).filter(([patientId, data]) =>
            Object.values(data).some(val => val !== null)
        )
    );
};

const deriveFinalVtialCvdData = (patientMap) => {
    const result = {};

    Object.entries(patientMap).forEach(([patientId, patient]) => {
        // Sort by encounterId descending (higher = newer)
        const sortedEncounters = [...patient.mainEncounters]
            .sort((a, b) => Number(b.encounterId) - Number(a.encounterId));
        const getLatestValue = (field, type) => {
            for (const enc of sortedEncounters) {
                let val = null
                if(type == null) {
                    console.log("check if entered here: ", type, field, enc[field])
                    val = enc[field];
                }
                else {
                    val = enc[type]?.[field];
                }
                if (val !== null && val !== undefined) return val;
            }
            return null;
        };

        result[patientId] = {
            // CVD
            facilityId:      getLatestValue("facilityId", null),
            sysBP:           getLatestValue("sysBP", "cvd"),
            diaBP:           getLatestValue("diaBP", "cvd"),
            bmi:             getLatestValue("bmi", "cvd"),
            smoker:          getLatestValue("smoker", "cvd"),
            screeningDate:   getLatestValue("screeningDate", "cvd"),
            cholesterol:     getLatestValue("cholesterol", "cvd"),
            cholesterolUnit: getLatestValue("cholesterolUnit", "cvd"),
            cvdRisk:            getLatestValue("cvdRisk", "cvd"),

            // Vitals
            glucose:         getLatestValue("glucose", "vitals"),
            glucoseUnit:     getLatestValue("glucoseUnit", "vitals"),
            glucoseType:     getLatestValue("glucoseType", "vitals"),
        };
    });

    return result
}

const fetchLocationList = async (ids, token, type) => {
    try {
        console.log(type, " ", ids)
        const resources = await fetchResource("Location", {
            type: type,
            _id: ids.join(","),
            _count: 100
        }, token)

        return resources.entry ? resources.entry.map(e => e.resource) : []
    }
    catch(error) {
        return Promise.reject(error)
    }
}



const getPatientDetails = async (patients, token) => {
    try {
        const patientIds = Object.keys(patients);
        console.log("patient ids: ", patientIds)
        await fetchInBatches(patientIds, BATCH_SIZE, async(batchIds) => {
            const patientResources = await fetchResource("Patient", {
                
                "_id": batchIds.join(","),
                "_count": batchIds.length
            }, token);

            // if (!patientResources?.entry?.length) return;
            patientResources.entry.forEach(e => {
                const resource = e.resource;
                const patientId = resource.id;
                if (!patients[patientId]) return;

                // Attach patient details
                patients[patientId].patientDetails = getTransformedResult(Patient, resource);
            });
        
        });
        return patients;
    }
    catch(error) {
        return Promise.reject(error)
    }
}

const getPatientLocationAndVitalClassificationDetails = async (patients, token) => {
    try {
        const provinceIds = [...new Set(patients.map(e => e.patientDetails.permanentAddress.state))]
        const provinceList = await fetchLocationList(provinceIds, token, "province");

        const areaCouncilIds = [...new Set(patients.map(e => e.patientDetails.permanentAddress.city))]
        const areaCouncilList = await fetchLocationList(areaCouncilIds, token, "area-council");

        const islandIds = [...new Set(patients.map(e => e.patientDetails.permanentAddress.district))]
        const islandList = await fetchLocationList(islandIds, token, "island");

        const villageIds = [...new Set(patients.map(e => e.patientDetails?.permanentAddress?.line?.[0]))]
        const villageList = await fetchLocationList(villageIds, token, "village");

        const facilityIds = [...new Set(patients.map(e => e.facilityId))]
        const orgResources = await fetchResource("Organization", {
            type: "health-facility",
            _count: 2000,
            _id: facilityIds.join(",")
        }, token);        
        const facilitiesList = orgResources.entry ? orgResources.entry.map(e => e.resource) : [];
        patients.forEach(patient => {
            const province = provinceList.find(e => e.id === patient.patientDetails.permanentAddress.state)
            patient.province = province.name;

            const areaCouncil = areaCouncilList.find(e => e.id === patient.patientDetails.permanentAddress.city)
            patient.areaCouncil = areaCouncil.name;

            const island = islandList.find(e => e.id === patient.patientDetails.permanentAddress.district)
            patient.island = island.name;

            const village = villageList.find(e => e.id === patient.patientDetails.permanentAddress?.line?.[0])
            patient.village = village?.name || null;
            
            const facility = facilitiesList.find(e => island.id === e.extension?.[1].valueReference?.reference.split("/")[1])
            patient.healthFacility = facility?.name || null;

            // patient.bmiClass = classification.bmiClassification(patient.bmi);
            // patient.bpClass = classification.bpClassification(patient.sysBP, patient.diaBP)
            // patient.glucoseClass = classification.glucoseClassification(patient.glucoseType, patient.glucoseUnit, patient.glucose)
            // patient.cholesterolClass = classification.cholesterolClassification(patient.cholesterol, patient.cholesterolUnit)
            // patient.cvdRiskClass = classification.riskClassification(patient.cvdRisk)
        })

        return patients;
    }
    catch(error) {
        return Promise.reject(error)
    }
}

const finalResponseStructure = (patients) => {
    return patients.map(e => ({
            "patientId": e.patientId,
            "patientName": e.patientDetails.firstName + " " + e.patientDetails.lastName,
            "age": classification.birthdateToAge(e.patientDetails.birthDate),
            "gender": e.patientDetails.gender,
        
            "province": e.province,
            "island": e.island,
            "areaCouncil": e.areaCouncil,
            "village": e.village,
        
            "bmi": e.bmi,
            // "bmiClass": e.bmiClass,
        
            "sysBP": e.sysBP,
            "diaBP": e.diaBP,
            // "bpClass": e.bpClass,
        
            "glucose": e.glucose,
            "glucoseType": e.glucoseType,
            "glucoseUnit": e.glucoseUnit,
            // "glucoseClass": e.glucoseClass,
        
            "cholesterol": e.cholesterol,
            // "cholesterolClass": e.cholesterolClass,
            "cholesterolUnit": e.cholesterolUnit,
        
            "smoker": e.smoker,
        
            "cvdRisk": e.cvdRisk,
            // "cvdRiskClass": e.cvdRiskClass,
        
            "healthFacility": e.healthFacility,
            "screeningSite": null,
            "screeningDate": e.screeningDate
    }))
}


const getFacilityDashboard = async function (req, res) {
    try {
        const token = req.accessToken;        
        const queryParams = req.query;
        const mainEncounterQuery = facilityMainEncounterQuery(queryParams);
        const mainEncounters = await fetchMainResourcesParallel("Encounter", mainEncounterQuery, token);
        //  check if data is not empty
        let patientMap = {};
        const mainEncounterIds = mainEncounters.entry ? mainEncounters.entry.map(e => e.resource.id) : []
        patientMap = groupEncountersByPatient(patientMap, mainEncounters, "mainEncounters");

        // fetch cvd data for every encounter
        patientMap = await fetchCvdData(mainEncounterIds, patientMap, token);

        // fetch vital data
        patientMap = await fetchVitalData(mainEncounterIds, patientMap, token)
        const filteredMap = filterPatientsWithData(patientMap); 

        //  get final cvd vitals
        const result = deriveFinalVtialCvdData(filteredMap)
        const filteredFinalData = filterFinalData(result); 
        await getPatientDetails(filteredFinalData, token)
        const patientArray = Object.entries(filteredFinalData).map(([patientId, data]) => ({
            patientId,
            ...data
        }));

        await getPatientLocationAndVitalClassificationDetails(patientArray, token)

        const finalData = finalResponseStructure(patientArray); 
        return res.status(200).json({
            status: 1,
            message: "Facility dashboard data fetched",
            data: finalData
        })
        
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


const getDivisionDashboard = async function (req, res) {
    try {


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


module.exports = {
    getFacilityDashboard, getDivisionDashboard
}