const { fetchResource,  getTransformedResult, fetchMainResourcesParallel, fetchInBatches } = require("../services/helperFunctions");

const classification = require("../services/dashboardClassification");
let Patient = require("../class/patient");
const urlList = require("../utils/heartcareSystemUrl")
// constants
const MAIN_ENCOUNTER_TYPE = "facility-main-encounter";
const TOTAL_COUNT = 500;
const BATCH_SIZE = 500;
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
            "_offset" : 0,
            "_sort": "-_id"
        };
}

const groupEncountersByPatient = (patientMap, encounters, type) => {
        if (!encounters || !encounters.entry) return;
        encounters.entry.forEach(entry => {
            const resource = entry.resource;
            const encounterId = resource.id;
            const patientId = resource.subject.reference.split("/")[1];
            if (!patientMap[patientId]) {
                
                 patientMap[patientId] = {
                    patientDetails: {},
                    mainEncounters: []
                };
            }
            console.log("encounterId: ", encounterId, " patientId: ", patientId, " facilityId: ", resource.serviceProvider.reference)

             patientMap[patientId][type].push({encounterId, facilityId: resource.serviceProvider.reference.split("/")[1]});
        });
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
                "_count": (BATCH_SIZE * 20) + batchIds.length,
                "_sort": "-_id"
            }, token);

            if (!response?.entry?.length) return;

            // Separate observations and included sub-encounters by search.mode
            const observations = response.entry.filter(e => e.search?.mode == "match");
            const subEncounters = response.entry.filter(e => e.search?.mode == "include");
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
                "_count": (BATCH_SIZE * 20) + batchIds.length,
                "_sort": "-_id"
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
    .sort((a, b) => {
        const dateA = new Date(a.cvd?.screeningDate ?? 0);
        const dateB = new Date(b.cvd?.screeningDate ?? 0);
        return dateB - dateA; // descending (latest first)
    });
        const getLatestValue = (field, type) => {
            for (const enc of sortedEncounters) {
                let val = null
                if(type == null) {
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
            patientDetails: patient?.patientDetails || null,
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
        const resources = await fetchResource("Location", {
            type: type,
            _id: ids.join(","),
            _count: 300,
            "_sort": "-_id"
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
        await fetchInBatches(patientIds, BATCH_SIZE, async(batchIds) => {
            const patientResources = await fetchResource("Patient", {
                
                "_id": batchIds.join(","),
                "_count": batchIds.length,
                "_sort": "-_id"
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

const getPatientLocationDetails = async (patients, token) => {
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
        console.log("facilityIds: ", facilityIds)
        const orgResources = await fetchResource("Organization", {
            type: "health-facility",
            _count: 2000,
            _id: facilityIds.join(","),
            "_sort": "-_id"
        }, token);        
        console.log(patients[0])
        const facilitiesList = orgResources.entry ? orgResources.entry.map(e => e.resource) : [];
        patients.forEach(patient => {
            
            const province = provinceList.find(e => e.id === patient.patientDetails.permanentAddress.state)
            patient.province = province.name;

            const areaCouncil = areaCouncilList.find(e => e.id === patient.patientDetails.permanentAddress.city)
            patient.areaCouncil = areaCouncil.name;

            const island = islandList.find(e => e.id === patient.patientDetails.permanentAddress.district)
            patient.island = island.name;

            const village = villageList.find(e => e.id === patient.patientDetails.permanentAddress?.addressLine1)
            patient.village = village?.name || null;

            const facility = facilitiesList.find(e => {
                const locationExt = e.extension?.find(
                    ext => ext.url == urlList.locationReferenceUrl
                );
                return island.id === locationExt?.valueReference?.reference.split("/")[1];
            });
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
            "patientName": [e.patientDetails.firstName, e.patientDetails.lastName].filter(Boolean).join(" "),
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
            })
        );

        await getPatientLocationDetails(patientArray, token)

        const finalData = finalResponseStructure(patientArray); 
        return res.status(200).json({
            status: 1,
            message: "Facility dashboard data fetched",
            total: finalData?.length || 0,
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

const facilityDivisionMainEncounterQuery = (queryParams) => {
    try {

        const query = {
            type: MAIN_ENCOUNTER_TYPE,
            "status": "finished,in-progress",
            "appointment.slot.start:0": `ge${queryParams.startDate}`,
            "appointment.slot.start:1": `le${queryParams.endDate}`,
            "_total": "accurate",
            "_count": TOTAL_COUNT,
            "_offset" : 0,
            "_sort": "-_id"
        };
        if(queryParams.divisionType == 1)
                query["patient.address-state"] = queryParams.divisionIds;
        else if(queryParams.divisionType == 2) {
            query["patient.address-city"] = queryParams.divisionIds;
        }
        else {
            query["patient.address"] = queryParams.divisionIds
        }

        return query;
    }
    catch(e) {
        return Promise.reject(e);
    }
}

const filterPatientsByDivision = (patientMap, divisionType, divisionIds) => {
    const divisionIdList = divisionIds.split(",").map(String);

    Object.keys(patientMap).forEach(patientId => {
        const address = patientMap[patientId]?.patientDetails?.permanentAddress;
        if (!address) { 
            delete patientMap[patientId]; 
            return; 
        }

        if (+divisionType === 3) {
            // island — district must match
            const district = address.district ? String(address.district) : null;
            if (!district || !divisionIdList.includes(district)) {
                delete patientMap[patientId];
            }
        } else if (+divisionType === 4) {
            // village — line[0] may be empty, only filter if it exists AND doesn't match
            const village = address?.line?.[0] ? String(address.line[0]) : null;
            if (village && !divisionIdList.includes(village)) {
                delete patientMap[patientId];
            }
            // if village is null/empty — keep the patient, don't filter out
        }
    });

    return patientMap;
};


const getDivisionDashboard = async function (req, res) {
    try {
        
        const token = req.accessToken;        
        const queryParams = req.query;
        const mainEncounterQuery = facilityDivisionMainEncounterQuery(queryParams);
        const mainEncounters = await fetchMainResourcesParallel("Encounter", mainEncounterQuery, token);
        if(!mainEncounters.entry) {
            return res.status(200).json({
                status: 1,
                message: "Data not found",
                total: 0,
                data: []
            })
        }
        //  check if data is not empty
        let patientMap = {};
        const mainEncounterIds = mainEncounters.entry ? mainEncounters.entry.map(e => e.resource.id) : []
        patientMap = groupEncountersByPatient(patientMap, mainEncounters, "mainEncounters");
        await getPatientDetails(patientMap, token);

        // if island or village we need to add filter
        if ([3, 4].includes(+queryParams.divisionType)) {
            filterPatientsByDivision(patientMap, queryParams.divisionType, queryParams.divisionIds);
        }
        // fetch cvd data for every encounter
        patientMap = await fetchCvdData(mainEncounterIds, patientMap, token);

        // fetch vital data
        patientMap = await fetchVitalData(mainEncounterIds, patientMap, token)
        const filteredMap = filterPatientsWithData(patientMap); 

        // get final cvd vitals
        const result = deriveFinalVtialCvdData(filteredMap)
        const filteredFinalData = filterFinalData(result); 
        const patientArray = Object.entries(filteredFinalData).map(([patientId, data]) => ({
            patientId,
            ...data
        }));

        await getPatientLocationDetails(patientArray, token)
        
        const finalData = finalResponseStructure(patientArray); 
        return res.status(200).json({
            status: 1,
            message: "Facility dashboard data fetched",
            total: finalData?.length || 0,
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


module.exports = {
    getFacilityDashboard, getDivisionDashboard
}