const { fetchResource,  getTransformedResult, fetchMainResourcesParallel, fetchInBatches } = require("../services/helperFunctions");

const classification = require("../services/dashboardClassification");
let Patient = require("../class/patient");
const urlList = require("../utils/heartcareSystemUrl");
const { query } = require("express-validator");
// constants
const MAIN_ENCOUNTER_TYPE = "facility-main-encounter";
const TOTAL_COUNT = 500;
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
            "_offset" : 0,
            "_sort": "-_id"
        };
}

const groupEncountersByPatient = (patientMap, encounters, type) => {
        if (!encounters || !encounters.entry) return patientMap;

        encounters.entry.forEach(entry => {
            const resource = entry.resource;
            const encounterId = resource.id;
            const patientId = resource.subject.reference.split("/")[1];

            // Extract Facility ID (Service Provider)
            const facilityId = resource.serviceProvider?.reference?.split("/")[1] || null;

            if (!patientMap[patientId]) {
                
                 patientMap[patientId] = {
                    patientDetails: {},
                    mainEncounters: []
                };
            }
            
            // We MUST check if this encounterId is already in the list 
            // (to prevent duplicates if an encounter shows up in both queries)
            const alreadyExists = patientMap[patientId][type].some(e => e.encounterId === encounterId);

            if (!alreadyExists) {
                patientMap[patientId][type].push({
                    encounterId,
                    facilityId, // <--- CRITICAL: Store this for the "Daily First" check
                    appointmentId: resource.appointment?.[0]?.reference?.split("/")?.[1] || null,
                    appointmentDate: null // Filled later by fetchAppointmentDates
                });
            }
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
        const lookup = subEncounterLookup[subEncounterId];
        if (!lookup) return;
        const mainId = lookup.mainEncounterId;
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
        const lookup = subEncounterLookup[subEncounterId];
        if (!lookup) return;
        const mainId = lookup.mainEncounterId;
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

const fetchAppointmentDates = async (patientMap, token) => {
    try {
        const appointmentIdToEncounters = {};

        Object.values(patientMap).forEach(patient => {
            patient.mainEncounters.forEach(enc => {
                if (enc.appointmentId) {
                    if (!appointmentIdToEncounters[enc.appointmentId]) {
                        appointmentIdToEncounters[enc.appointmentId] = [];
                    }
                    appointmentIdToEncounters[enc.appointmentId].push(enc);
                }
            });
        });

        const appointmentIds = Object.keys(appointmentIdToEncounters);
        console.log("Fetching appointment dates for: ", appointmentIds.length, " appointments");
        if (!appointmentIds.length) return;

        await fetchInBatches(appointmentIds, BATCH_SIZE, async (batchIds) => {
            const response = await fetchResource("Appointment", {
                "_id":      batchIds.join(","),
                "_include": "Appointment:slot",        // pulls slot in same response
                "_count":   batchIds.length * 3,       // appointments + slots
                "_sort":    "-_id"
            }, token);

            if (!response?.entry?.length) return;

            // Separate appointments and included slots
            const appointments = response.entry.filter(e => e.search?.mode === "match");
            const slots        = response.entry.filter(e => e.search?.mode === "include");

            // Build slot lookup map
            const slotMap = {};
            slots.forEach(e => {
                slotMap[e.resource.id] = e.resource.start ?? null;
            });

            // Map slot date back to encounters via appointment
            appointments.forEach(e => {
                const appointment   = e.resource;
                const appointmentId = appointment.id;
                const slotId        = appointment.slot?.[0]?.reference?.split("/")?.[1];

                // FIX: appointment might have no slot — appointmentDate stays null
                const slotDate = slotId ? (slotMap[slotId] ?? null) : null;

                const encounters = appointmentIdToEncounters[appointmentId];
                if (encounters) {
                    encounters.forEach(enc => enc.appointmentDate = slotDate);
                    // null appointmentDate → encounter dropped by cleanPatientMapToDailyFirst
                    // which is correct — no slot = no valid date = not included
                }
            });
        });

    } catch (error) {
        console.error("fetchAppointmentDates error: ", error);
        return Promise.reject(error);
    }
};


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



const deriveFinalVtialCvdData = (patientMap) => {
    const result = {};

    Object.entries(patientMap).forEach(([patientId, patient]) => {
        // 1. Group by Date (Already filtered by cleanPatientMapToDailyFirst)
        // We just need to sort the remaining valid encounters newest to oldest
        const sortedHistory = [...patient.mainEncounters].sort((a, b) => {
            return new Date(b.appointmentDate) - new Date(a.appointmentDate);
        });

        if (sortedHistory.length === 0) return;

        const getLatestValue = (field, type) => {
            for (const enc of sortedHistory) {
                const val = type == null ? enc[field] : enc[type]?.[field];
                // Check for null, undefined, or empty string
                if (val !== null && val !== undefined && val !== "") return val;
            }
            return null;
        };

        result[patientId] = {
            patientDetails: patient?.patientDetails || null,
            facilityId:      sortedHistory[0].facilityId,
            // The display date is the Slot Start of the most recent valid encounter
            screeningDate:   sortedHistory[0].appointmentDate, 

            // Clinical Look-back (fills gaps from older appointments)
            sysBP:           getLatestValue("sysBP", "cvd"),
            diaBP:           getLatestValue("diaBP", "cvd"),
            bmi:             getLatestValue("bmi", "cvd"),
            smoker:          getLatestValue("smoker", "cvd"),
            cholesterol:     getLatestValue("cholesterol", "cvd"),
            cholesterolUnit: getLatestValue("cholesterolUnit", "cvd"),
            cvdRisk:         getLatestValue("cvdRisk", "cvd"),
            glucose:         getLatestValue("glucose", "vitals"),
            glucoseUnit:     getLatestValue("glucoseUnit", "vitals"),
            glucoseType:     getLatestValue("glucoseType", "vitals"),
        };
    });

    return result;
};

const fetchLocationList = async (ids, token, type) => {
    try {
        const resources = await fetchResource("Location", {
            type: type,
            _id: ids.join(","),
            _count: 5000,
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

            if (!patientResources?.entry?.length) return;
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
        const provinceIds = [...new Set(patients.map(e => e.patientDetails.permanentAddress.state))];
        const areaCouncilIds = [...new Set(patients.map(e => e.patientDetails.permanentAddress.city))];
        const islandIds = [...new Set(patients.map(e => e.patientDetails.permanentAddress.district))];
        const villageIds = [...new Set(patients.map(e => e.patientDetails.permanentAddress?.addressLine1).filter(Boolean))];
        const facilityIds = [...new Set(patients.map(e => e.facilityId))];

        const [provinceList, areaCouncilList, islandList, villageList, orgResources] = await Promise.all([
            fetchLocationList(provinceIds, token, "province"),
            fetchLocationList(areaCouncilIds, token, "area-council"),
            fetchLocationList(islandIds, token, "island"),
            fetchLocationList(villageIds, token, "village"),
            fetchResource("Organization", {
                type: "health-facility",
                _count: 2000,
                _id: facilityIds.join(","),
                "_sort": "-_id"
            }, token)
        ]);

        // Build Lookup Maps (Objects) O(1)
        const provinceMap    = Object.fromEntries(provinceList.map(e => [e.id, e.name]));
        const councilMap     = Object.fromEntries(areaCouncilList.map(e => [e.id, e.name]));
        const islandMap      = Object.fromEntries(islandList.map(e => [e.id, e.name]));
        const villageMap     = Object.fromEntries(villageList.map(e => [e.id, e.name]));
        const facilityMap    = Object.fromEntries((orgResources.entry || []).map(e => [e.resource.id, e.resource.name]));

        // Optimized Mapping Loop
        patients.forEach(patient => {
            const addr = patient.patientDetails?.permanentAddress || {};
            
            patient.province       = provinceMap[addr.state] || null;
            patient.areaCouncil    = councilMap[addr.city] || null;
            patient.island         = islandMap[addr.district] || null;
            patient.village        = villageMap[addr.addressLine1] || null;
            patient.healthFacility = facilityMap[patient.facilityId] || null;
        });

        return patients;
    } catch (error) {
        console.error("Error in getPatientLocationDetails:", error);
        return Promise.reject(error);
    }
};

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

const cleanPatientMapToDailyFirst = (patientMap, requestedFacilityIds) => {
    Object.keys(patientMap).forEach(patientId => {
        const patient = patientMap[patientId];
        const dailyGroups = {};

        // Group all encounters by the YYYY-MM-DD of the Slot
        patient.mainEncounters.forEach(enc => {
            if (!enc.appointmentDate) return;
            const dateKey = enc.appointmentDate.slice(0, 10);
            if (!dailyGroups[dateKey]) dailyGroups[dateKey] = [];
            dailyGroups[dateKey].push(enc);
        });

        const validEncounters = [];

        Object.values(dailyGroups).forEach(dayEncounters => {
            // Sort Earliest to Latest
            dayEncounters.sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate));
            const earliestEncounter = dayEncounters[0];

            // Fix for Issue #5: Check if the earliest facility is in the allowed list
            if (requestedFacilityIds.includes(String(earliestEncounter.facilityId))) {
                validEncounters.push(earliestEncounter);
            }
        });

        patient.mainEncounters = validEncounters;
        if (patient.mainEncounters.length === 0) delete patientMap[patientId];
    });
};

const getFacilityDashboard = async function (req, res) {
    try {
        const token = req.accessToken;        
        const queryParams = req.query;
        queryParams._sort = queryParams._sort || "-_id";
        queryParams._count = TOTAL_COUNT;
        const requestedFacilityIds = String(queryParams.facilityIds).split(",").map(String);
        const mainEncounterQuery = facilityMainEncounterQuery(queryParams);
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
        groupEncountersByPatient(patientMap, mainEncounters, "mainEncounters");
       
       // 2. Fetch Cross-Facility context
        // This finds if these patients went elsewhere during the same date range
        const patientIds = Object.keys(patientMap);
        await fetchInBatches(patientIds, BATCH_SIZE, async (batchIds) => {
            const crossResponse = await fetchResource("Encounter", {
                type: MAIN_ENCOUNTER_TYPE,
                "subject": batchIds.join(","),
                "status": "finished,in-progress",
                "appointment.slot.start:0": `ge${queryParams.startDate}`,
                "appointment.slot.start:1": `le${queryParams.endDate}`,
                "_count": TOTAL_COUNT * 2
            }, token);

            if (crossResponse?.entry) {
                // Add these "other" encounters to the same patientMap for comparison
                groupEncountersByPatient(patientMap, crossResponse, "mainEncounters");
            }
        });

        // 3. Populate appointmentDate for EVERY encounter in the map
        await fetchAppointmentDates(patientMap, token);

        // --- STAGE 2: The Cleanup (The Call Site) ---
        // We call it here so we only fetch clinical data for "Daily Winners"
        cleanPatientMapToDailyFirst(patientMap, requestedFacilityIds);

        // --- STAGE 3: Clinical Fetching ---
        const validMainEncounterIds = [];
        Object.values(patientMap).forEach(p => {
            p.mainEncounters.forEach(e => validMainEncounterIds.push(e.encounterId));
        });

        if (validMainEncounterIds.length > 0) {
            await Promise.all([
                fetchCvdData(validMainEncounterIds, patientMap, token),
                fetchVitalData(validMainEncounterIds, patientMap, token)
            ]);
        }
        console.log("Completed clinical data fetch. Now deriving final data. Patient count: ", Object.keys(patientMap).length);
        // --- STAGE 4: Derivation & Final Response ---
        const derivedData = deriveFinalVtialCvdData(patientMap);
        const patientArray = Object.entries(derivedData).map(([patientId, data]) => ({ patientId, ...data }));
        await getPatientDetails(Object.fromEntries(patientArray.map(p => [p.patientId, p])), token);
        await getPatientLocationDetails(patientArray, token);

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

const buildPatientArray = async (patientMap, queryParams, token) => {

    // We fetch every appointment for these patients in this date range
    const patientIds = Object.keys(patientMap);
    await fetchInBatches(patientIds, BATCH_SIZE, async (batchIds) => {
        const crossRes = await fetchResource("Encounter", {
            type: MAIN_ENCOUNTER_TYPE,
            "subject": batchIds.join(","),
            "status": "finished,in-progress",
            "appointment.slot.start:0": `ge${queryParams.startDate}`,
            "appointment.slot.start:1": `le${queryParams.endDate}`,
            _count: TOTAL_COUNT * 2
        }, token);
        if (crossRes?.entry) groupEncountersByPatient(patientMap, crossRes, "mainEncounters");
    });

    // 3. Resolve dates for the new encounters we just added
    await fetchAppointmentDates(patientMap, token);

    // 4. Enforce "One Appointment Per Day" (Earliest Wins)
    // Note: In Division API, we don't filter by a single Facility ID,
    // we just want the earliest one for that day to be the representative.
    cleanPatientMapToDailyFirstInDivision(patientMap);

    // 4. Fetch clinical data for survivors only
    const validMainEncounterIds = [];
    Object.values(patientMap).forEach(p => {
        p.mainEncounters.forEach(e => validMainEncounterIds.push(e.encounterId));
    });

    if (validMainEncounterIds.length > 0) {
        await Promise.all([
            fetchCvdData(validMainEncounterIds, patientMap, token),
            fetchVitalData(validMainEncounterIds, patientMap, token)
        ]);
    }

    const result = deriveFinalVtialCvdData(patientMap);
    return Object.entries(result).map(([patientId, data]) => ({ patientId, ...data }));
};

const cleanPatientMapToDailyFirstInDivision = (patientMap) => {
    Object.keys(patientMap).forEach(patientId => {
        const patient = patientMap[patientId];
        const dailyGroups = {};

        patient.mainEncounters.forEach(enc => {
            if (!enc.appointmentDate) return;
            const dateKey = enc.appointmentDate.slice(0, 10);
            if (!dailyGroups[dateKey]) dailyGroups[dateKey] = [];
            dailyGroups[dateKey].push(enc);
        });

        const validEncounters = [];

        Object.values(dailyGroups).forEach(dayEncounters => {
            // Sort by full Slot time ASC (Earliest first)
            dayEncounters.sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate));
            
            // Keep the absolute earliest one, discard the rest for that day
            validEncounters.push(dayEncounters[0]);
        });

        patient.mainEncounters = validEncounters;
    });
};

const getDivisionDashboard = async function (req, res) {
    try {
        
        const token = req.accessToken;        
        const queryParams = req.query;
        queryParams._sort = queryParams._sort || "-_id";
        queryParams._count = TOTAL_COUNT;
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
        patientMap = groupEncountersByPatient(patientMap, mainEncounters, "mainEncounters");
        await getPatientDetails(patientMap, token);

        // if island or village we need to add filter
        if ([3, 4].includes(+queryParams.divisionType)) {
            filterPatientsByDivision(patientMap, queryParams.divisionType, queryParams.divisionIds);
        }
        
        const patientArray = await buildPatientArray(patientMap, queryParams, token);

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