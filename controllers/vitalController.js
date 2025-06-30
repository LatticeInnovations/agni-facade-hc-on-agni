let axios = require("axios");
const Observation = require("../class/VitalCVDObservation");
const Encounter = require("../class/VitalEncounter");
const bundleStructure = require("../services/bundleOperation");
const responseService = require("../services/responseService");
const {buildFHIRResource, fetchResource, handleError, getTransformedResult} = require("../services/helperFunctions");


const { v4: uuidv4 } = require('uuid');
let config = require("../config/nodeConfig");
const resourceType = "Observation";

const RESOURCE_TYPES = {
    ENCOUNTER: "Encounter",
    PRACTITIONER: "Practitioner",
    OBSERVATION: "Observation"
};

const VITAL_ENCOUNTER_CODE = "vital-encounter";
const HTTP_METHODS = {
    POST: "POST",
    GET: "GET"
}

const BUNDLE_TYPES = {
    IDENTIFIER: "identifier"
}

// Step 1: vital types list
const vitalTypes = [
    "height", "weight", "heartRate", "respRate", "spo2", "temperature", "bp", 
    "bloodGlucose", "eyeTest"
  ];

const createObservationBundle = async(vital, type) => {
    try {
        vital.module_type = "vital";
        const resource = buildFHIRResource(Observation, { ...vital, optionalParam: type });
        resource.id = uuidv4();
        return await bundleStructure.setBundlePost(resource, null, resource.id, HTTP_METHODS.POST, BUNDLE_TYPES.IDENTIFIER);
    }
    catch (error) {
        console.warn(`Vital '${type}' skipped:`, error.message);
        return null; // Return null for skipped vital types
    }
}

const createEncounterBundle = async(vital, encounterData, req) => {
    try {
        // const encounterUuid = uuidv4();
        console.log(vital)
        const encounter = buildFHIRResource(Encounter, {
            id: vital.vitalUuid,
            encounterId: encounterData.entry[0].resource.id,
            patientId: vital.patientId,
            vitalUuid: vital.vitalUuid,
            practitionerId: req.decoded.userId,
            generatedOn: vital.createdOn,
            orgId: req.decoded.orgId
        });
    return await bundleStructure.setBundlePost(encounter, null, vital.vitalUuid, HTTP_METHODS.POST, BUNDLE_TYPES.IDENTIFIER);
    }
    catch (error) {
        console.error(`createEncounterBundle Error:`, error.message);
        throw error;
    }
}

let setVitalData = async function (req, res) {
    try {
        const allResourceResults = [];

        await Promise.all(req.body.map(async (vital) => {
            const resourceResult = [];
            // Fetch encounter data
            const encounterData = await fetchResource("Encounter", {  appointment: vital.appointmentId, _count: 5000, _include: "Encounter:appointment"
            });

            // Create encounter bundle
            const encounterBundle = await createEncounterBundle(vital, encounterData, req);
            resourceResult.push(encounterBundle);
            console.log("encounterBundle: ", encounterBundle)
            vital.encounterId = vital.vitalUuid;
            vital.practitionerId = req.decoded.userId;
            // Create observation bundles for all vital types
            const observationBundles = await Promise.all(                
                vitalTypes.map((type) => createObservationBundle(vital, type))
            );

            // Filter out null values (skipped vital types)
            resourceResult.push(...observationBundles.filter((bundle) => bundle !== null));
            allResourceResults.push(...resourceResult);

        }))
        console.info("=============>", allResourceResults, "<=========================");
        const bundleData = await bundleStructure.getBundleJSON({resourceResult: allResourceResults, errData: []});
        console.log("bundle data", bundleData)
        // return res.status(201).json({bundleData: bundleData.bundle})
        const response = await axios.post(config.baseUrl, bundleData.bundle); 
        console.log("get bundle json response: ", response.status)  
        if (response.status == 200 || response.status == 201) {
            const responseData = setVitalResponse(bundleData.bundle.entry, response.data.entry, "post");
            res.status(201).json({ status: 1, message: "Vital saved.", data: responseData })
        }
        else {
            return handleError(res, response)
        }
    }
    catch(error) {
        console.error("setVitalData Error: ", error)
        return handleError(res, error)
    }

}

/**
 * Fetch practitioner name based on practitioner ID.
 */
const getPractitionerName = (practitionerId, practitionerData) => {
    const practitioner = practitionerData.find((e) => e?.resource?.id === practitionerId);

    if (!practitioner) return "";

    const givenName = practitioner?.resource?.name?.[0]?.given?.join(" ") || "";
    const familyName = practitioner?.resource?.name?.[0]?.family || "";
    return `${givenName} ${familyName}`.trim();
};

// Process observation data and merge with encounter data.

const processObservationData = (observationList, observationData) => {
    return observationList.map((observation) => {
        try {
            // Dynamically transform the observation using the helper function
            observation.module_type = "vital";
            const transformedObservation = getTransformedResult(Observation, observation);
            return { ...observationData, ...transformedObservation };
        } catch (error) {
            console.warn(`Error processing observation: ${observation.id}`, error.message);
            return observationData; // Return original data if transformation fails
        }
    }).reduce((mergedData, data) => ({ ...mergedData, ...data }), observationData);
};


const getVitalObservationList = async (vitalEncounterList, practitionerList, mainEncounters, observations) => {
    try {
        return vitalEncounterList.map((encounter) => {
            let observationData = getTransformedResult(Encounter, encounter);

            // Add practitioner name
            observationData.practitionerName = getPractitionerName(observationData.practitionerId, practitionerList);

            // Add creation date
            observationData.createdOn = encounter.period.start;

            // Add appointment ID from main encounter
            const primaryEncounter = mainEncounters.find((e) => e.id === observationData.primaryEncounterId);
            observationData.appointmentId = primaryEncounter?.appointment?.[0]?.reference?.split("/")[1] || null;
            observationData.appointmentUuid = primaryEncounter?.identifier?.[0].value;
            // Remove unnecessary fields
            delete observationData.primaryEncounterId;
            delete observationData.practitionerId;

            // Process observations for the encounter
            const observationList = observations.filter(
                (obs) => obs.encounter.reference === `${RESOURCE_TYPES.ENCOUNTER}/${encounter.id}`
            );
            observationData = processObservationData(observationList, observationData);

            return observationData;
        });
    }
    catch(error) {
        console.error("getVitalObservationList Error: ", error)
        throw error;
    }
}

const getVitalData = async function(req, res) {
    try {
            const queryParams = {
                _total : "accurate",
                _count: req.query._count,
                _offset: req.query._offset,
                _sort: req.query._sort,
                type: "vital-encounter",
                "service-provider": req.decoded.orgId
            }
            const link = config.baseUrl + RESOURCE_TYPES.ENCOUNTER;
            const resourceUrlData = { link, reqQuery: queryParams, allowNesting: 0, specialOffset: 1 };

            // Fetch resources in parallel
            const [responseData, practitionerData] = await Promise.all([
                fetchResource(RESOURCE_TYPES.ENCOUNTER, queryParams),
                fetchResource(RESOURCE_TYPES.PRACTITIONER, { _count: 10000 })
            ]);
            if( !responseData.entry || responseData.total == 0) {
                return res.status(200).json({ status: resStatus, message: "Data fetched", total: 0, data: []  })
            }
            const practitionerList = practitionerData.entry;

            // Extract vital encounters and main encounters
            const vitalEncounterList = responseData.entry .filter((e) => e.resource.type?.[0]?.coding?.[0]?.code === VITAL_ENCOUNTER_CODE)
            .map((e) => e.resource);

            const vitalEncounterIds = vitalEncounterList.map((e) => e.id).join(",");
            const mainEncounterIds = vitalEncounterList.map((e) => e.partOf?.reference?.split("/")[1]).filter(Boolean).join(",");

            const [mainEncounterList, allObservations] = await Promise.all([
                fetchResource(RESOURCE_TYPES.ENCOUNTER, { _id: mainEncounterIds, _count: 10000 }),
                fetchResource(RESOURCE_TYPES.OBSERVATION, { encounter: vitalEncounterIds, _count: 100000 })
            ]);
    
            const mainEncounters = mainEncounterList.entry.map((e) => e.resource);
            const observations = allObservations.entry.map((e) => e.resource);

            // Process vital encounters
            const resourceResult = await getVitalObservationList(vitalEncounterList, practitionerList, mainEncounters, observations);
            
            const resStatus = bundleStructure.setResponse(resourceUrlData, responseData);
            return res.status(200).json({ status: resStatus, message: "Data fetched", total: resourceResult.length, data: resourceResult
            });
    } 
    catch(error) {
        console.error("getVitalData Error: ", error)
        return handleError(res, error)
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