let axios = require("axios");
const Encounter = require("../class/VitalEncounter");
const bundleStructure = require("../services/bundleOperation");
const responseService = require("../services/responseService");
const {fetchResource, handleError, getTransformedResult} = require("../services/helperFunctions");
let { vitalSaveSchema } = require("../utils/Validator/vitalValidator");
const {validateRequest} = require("../utils/validateRequest");
const {createObservationBundle, createEncounterBundle, getPractitionerName, processObservationData} = require("../services/commonFunctions");

let config = require("../config/nodeConfig");
const resourceType = "Observation";

const RESOURCE_TYPES = {
    ENCOUNTER: "Encounter",
    PRACTITIONER: "Practitioner",
    OBSERVATION: "Observation"
};

const VITAL_ENCOUNTER_CODE = "vital-test-encounter";


// Step 1: vital types list
const vitalTypes = {
    bloodGlucose:  "36048009",
    serumCreatinine: "113075003",
    abdominalCircumference:"396552003",
    hipCircumference: "284472007",
    serumPotassium: "271236005",
    hbA1cPercentage: "43396009",
    urineProtein: "57378007",
    urineKetones: "271347000",
    eyeExamination: "36228007",
    footExamination: "284384005",
    others: "74964007",
  }
    
  const vitalTypes2 = [
    "bloodGlucose", "serumCreatinine", "abdominalCircumference", "hipCircumference", "serumPotassium", "hbA1cPercentage",
    "urineProtein", "urineKetones", "eyeExamination", "footExamination", "others"
  ]




const fetchMainEncounter = async (vital) => {
    const mainEncounter =   await fetchResource("Encounter", {
         appointment: vital.appointmentId,
         _count: 5000,
         _include: "Encounter:appointment",
     });
 
     console.log(mainEncounter)
 
     return mainEncounter
 }
 
 const fetchVitalEncounter = async (baseEncounterId) => {
    const result =  await fetchResource("Encounter", {  "part-of": baseEncounterId, type: "vital-test-encounter", _total: "accurate"});
    return result;
 }
 

let setVitalData = async function (req, res) {
    try {
        const validatedBody = validateRequest(req.body, vitalSaveSchema, res);
        if (!validatedBody) return;
        req.queueMeta = {
            data: req.body,
            entity: "vital",
            requestType: "post",
            apiName: "save-vital",
            tokenData: req.decoded
          };
        console.log("inside vital")
        let requestType = "post"
        const allResourceResults = [], errData = [];
        await Promise.all(
            req.body.map(async (vital) => {
                const resourceResult = [];
                const practitionerId = req.decoded.userId;

                const encounterData = await fetchMainEncounter(vital)
                const baseEncounterId = encounterData?.entry?.[0]?.resource?.id;
                if (!baseEncounterId) return;
                console.log("encounter data check: ============>", encounterData)
                
                const vitalEncounter = await fetchVitalEncounter(baseEncounterId)
                console.log("vitalEncounter check: ", vitalEncounter)
                if (vitalEncounter.total > 0 && vitalEncounter.entry) {
                    console.log("put case")
                    // Update case (PUT)
                    await handleExistingVitalEncounter({vital, vitalEncounter, baseEncounterId, practitionerId, resourceResult});
                } else {
                    // Create case (POST)
                    console.log("post case")
                      requestType = "put"
                    await handleNewVitalEncounter({vital, baseEncounterId, practitionerId, resourceResult, });
                }
                console.log("resourceResult: ", resourceResult)

                allResourceResults.push(...resourceResult);
            })
        );

        const bundleData = await bundleStructure.getBundleJSON({
            resourceResult: allResourceResults, errData,
        });

        // return res.status(201).json({   status: 1,   message: "Vital data saved.",  data: allResourceResults });

        const response = await axios.post(config.baseUrl, bundleData.bundle);
        console.log("response: ", response.data, requestType)
        if ([200, 201].includes(response.status)) {
            
            const resourceResponse =  setVitalResponse(bundleData.bundle.entry, response.data.entry, "post");
            const responseData = [...resourceResponse, ...errData];   
            return res.status(201).json({
                status: 1,
                message: "Vital data saved.",
                data: responseData,
            });
        }

        return handleError(res, response);
    }
    catch(error) {
        console.error("setVitalData Error: ", error)
        return handleError(res, error)
    }

}

async function handleExistingVitalEncounter({ vital, vitalEncounter, baseEncounterId, practitionerId, resourceResult }) {
    const existingEncounter = vitalEncounter.entry[0].resource;
    const observations = await fetchResource(RESOURCE_TYPES.OBSERVATION, {
        encounter: existingEncounter.id,
    });

    const encounterBundle = await createEncounterBundle(Encounter, {
        encounterId: baseEncounterId,
        fhirId: existingEncounter.id,
        patientId: vital.patientId,
        uuid: existingEncounter.identifier?.[0]?.value || vital.uuid,
        reqUuid: vital.uuid,
        practitionerId,
        generatedOn: vital.appUpdatedDate
    }, "put");

    resourceResult.push(encounterBundle);

    Object.assign(vital, {
        encounterId: existingEncounter.id,
        practitionerId,
        categoryCode: "Vital",
        categoryDisplay: "Vital risk assessment",
    });

    const observationBundles = await Promise.all(
        Object.entries(vitalTypes).map(([key, code]) => {
            console.log("check ere in existing: ", key, code)
            const vitalData = vital[key]
            let observationValue, unit, type;
            if(vitalData == null) {
              observationValue = null;
              unit = null;
              type =  null;
            }
            else if (typeof vitalData === "object" &&
                "value" in vitalData)  {
              observationValue = vitalData.value ?? null;
              unit =vitalData.unit ?? null;
              type = vitalData?.type || null;
            } else {
              observationValue = vitalData;
            }
            const matchingObservation = observations.entry?.find(
                e => e.resource.code.coding[0].code === code
            );
            if (!matchingObservation) return null;

            const fhirId = matchingObservation.resource.id;
          return  createObservationBundle({
              value: observationValue,
              unit,
              type,
              fhirId,
              encounterId: "Encounter/" + existingEncounter.id,
              practitionerId,
              patientId: vital.patientId,
              appUpdatedDate: vital.appUpdatedDate
            }, key, "put", "Vital")
          })
    );

    resourceResult.push(...observationBundles.filter(Boolean));
}


async function handleNewVitalEncounter({ vital, baseEncounterId, practitionerId, resourceResult }) {
    const encounterBundle = await createEncounterBundle(Encounter, {
        encounterId: baseEncounterId,
        patientId: vital.patientId,
        uuid: vital.uuid,
        reqUuid: vital.uuid,
        practitionerId,
        generatedOn: vital.appUpdatedDate
    }, "post");

    resourceResult.push(encounterBundle);
    const observationBundles = await Promise.all(
        Object.entries(vitalTypes).map(([key, value]) => {
            const vitalData = vital[key];
            console.log("value: ", value)
            let observationValue, unit, type;
            if(vitalData == null) {
                observationValue = null;
              unit = null;
              type =  null;
            }
            else if (typeof vitalData === "object" &&
                "value" in vitalData) {
              observationValue = vitalData.value ?? null;
              unit =vitalData.unit ?? null;
              type = vitalData.type ?? null;
            } else {
              observationValue = vitalData;
            }
          
           return createObservationBundle({
              value: observationValue,
              unit,
              type,
              categoryCode: "Vital",
              categoryDisplay: "Vital assessment",
              encounterId: "urn:uuid:" +  vital.uuid,
              practitionerId,
              patientId: vital.patientId,
              appUpdatedDate: vital.appUpdatedDate
            }, key, "post", "Vital" )
          })
    );
    console.log("observationBundles: ", observationBundles)
    resourceResult.push(...observationBundles.filter(Boolean));
}

const getVitalObservationList = async (vitalEncounterList, practitionerList, mainEncounters) => {
    try {
        const result = await Promise.all(
            vitalEncounterList.map(async (encounter) => {
                const allObservations = await fetchResource("Observation", { encounter: encounter.id, _count: 20000 })
                    const observations = allObservations.entry.map((e) => e.resource);
                    let observationData = getTransformedResult(Encounter, encounter);
    
                // Add practitioner name
                observationData.practitionerName = getPractitionerName(observationData.practitionerId, practitionerList);
    
                // Add creation date
                observationData.appUpdatedDate = encounter.period.start;
    
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
                observationData = processObservationData(observationList, observationData, "Vital");
               
                return observationData;
            })
        )

        console.log("observationData: ", result)
        return result;
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
                type: "vital-test-encounter"
            }
            const link = config.baseUrl + RESOURCE_TYPES.ENCOUNTER;
            const resourceUrlData = { link, reqQuery: queryParams, allowNesting: 0, specialOffset: 1 };

            // Fetch resources in parallel
            const [responseData, practitionerData] = await Promise.all([
                fetchResource(RESOURCE_TYPES.ENCOUNTER, queryParams),
                fetchResource(RESOURCE_TYPES.PRACTITIONER, { _count: 10000 })
            ]);
            if( !responseData.entry || responseData.total == 0) {
                return res.status(200).json({ status: 2, message: "Data fetched", total: 0, data: []  })
            }
            const practitionerList = practitionerData.entry;

            // Extract vital encounters and main encounters
            const vitalEncounterList = responseData.entry .filter((e) => e.resource.type?.[0]?.coding?.[0]?.code === VITAL_ENCOUNTER_CODE)
            .map((e) => e.resource);

            const mainEncounterIds = vitalEncounterList.map((e) => e.partOf?.reference?.split("/")[1]).filter(Boolean).join(",");

            const mainEncounterList = await fetchResource(RESOURCE_TYPES.ENCOUNTER, { _id: mainEncounterIds, _count: 10000 });
                       
            const mainEncounters = mainEncounterList.entry.map((e) => e.resource);
                   
            // Process vital encounters
            const resourceResult = await getVitalObservationList(vitalEncounterList, practitionerList, mainEncounters);
            console.log("resourceResult:  ", resourceResult)
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
       console.log("reqBundleData: ", reqBundleData, "and: responseBundleData",  responseBundleData)
       const responseData = bundleStructure.mapAssessmentBundleService(reqBundleData, responseBundleData)
       if(["post", "POST", "put", "PUT"].includes(type)){
           filteredData = responseData.filter(e => e.resource.resourceType == "Encounter" && e.resource?.type?.[0]?.coding?.[0]?.code == "vital-test-encounter");
       }
       else if(["patch", "PATCH"].includes(type)) {
           filteredData = responseData.filter(e => e.fullUrl.split("/")[0] == "Observation");
           
       }  
       response = responseService.setDefaultAssessmentResponse("Encounter", type, filteredData)
       return response;
}

module.exports = { setVitalData, getVitalData }