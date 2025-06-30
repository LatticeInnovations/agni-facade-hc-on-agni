const bundleStructure = require("../services/bundleOperation")
const responseService = require("../services/responseService");
let config = require("../config/nodeConfig");
const Observation = require("../class/VitalCVDObservation");
const Encounter = require("../class/CVDEncounter");
let bundleFun = require("../services/bundleOperation");
const { v4: uuidv4 } = require('uuid');
let axios = require("axios");
const {buildFHIRResource, fetchResource, handleError, getTransformedResult} = require("../services/helperFunctions");

const RESOURCE_TYPES = {
    ENCOUNTER: "Encounter",
    PRACTITIONER: "Practitioner",
    OBSERVATION: "Observation"
};

const CVD_ENCOUNTER_CODE = "cvd-encounter";
const HTTP_METHODS = {
    POST: "POST",
    GET: "GET"
}

const BUNDLE_TYPES = {
    IDENTIFIER: "identifier"
}

const cvdTypes = ["height", "weight",  "bp", "cholesterol", "bmi", "diabetic", "smoker", "risk"];


const createObservationBundle = async(CVD, type) => {
    try {
        CVD.module_type = "CVD";
        const resource = buildFHIRResource(Observation, { ...CVD, optionalParam: type });
        resource.id = uuidv4();
        return await bundleStructure.setBundlePost(resource, null, resource.id, HTTP_METHODS.POST, BUNDLE_TYPES.IDENTIFIER);
    }
    catch (error) {
        console.warn(`CVD '${type}' skipped:`, error.message);
        return null; // Return null for skipped CVD types
    }
}

const createEncounterBundle = async(cvd, encounterData, req) => {
    try {
        let encounterUuid = cvd.cvdUuid;
        console.log(cvd)
        const encounter = buildFHIRResource(Encounter, { 
                id: encounterUuid,
                encounterId: encounterData.entry[0].resource.id,
                patientId: cvd.patientId,
                cvdUuid: encounterUuid,
                practitionerId: req.decoded.userId,
                generatedOn: cvd.createdOn,
                orgId: req.decoded.orgId
            });
        console.log("encounter data: ", encounter)
    return await bundleStructure.setBundlePost(encounter, null, cvd.cvdUuid, HTTP_METHODS.POST, BUNDLE_TYPES.IDENTIFIER);
    }
    catch (error) {
        console.error(`createEncounterBundle Error:`, error.message);
        throw error;
    }
}

const saveCVDData = async (req, res) => {
    try {
        const allResourceResults = [];
        await Promise.all(req.body.map(async (cvd) => {
                    const resourceResult = [];
                    // Fetch encounter data
                    const encounterData = await fetchResource("Encounter", {
                        appointment: cvd.appointmentId,
                        _count: 5000,
                        _include: "Encounter:appointment"
                    });
        
                    // Create encounter bundle
                    const encounterBundle = await createEncounterBundle(cvd, encounterData, req);
                    resourceResult.push(encounterBundle);
                    console.log("encounterBundle: ", encounterBundle)
                    cvd.encounterId = cvd.cvdUuid;
                    cvd.practitionerId = req.decoded.userId;
                    cvd.categoryCode = "CVD";
                    cvd.categoryDisplay = "CVD risk assessment";
                    const observationBundles = await Promise.all(                
                        cvdTypes.map((type) => createObservationBundle(cvd, type))
                    );
        
                    // Filter out null values (skipped cvd types)
                    resourceResult.push(...observationBundles);        
                    allResourceResults.push(...resourceResult);
        
                }));
        let bundleData = await bundleStructure.getBundleJSON({resourceResult: allResourceResults, errData: []})  
        // res.status(201).json({ status: 1, message: "CVD data saved.", data: bundleData })
        let response = await axios.post(config.baseUrl, bundleData.bundle); 
        console.info("get bundle json response: ", response.status)  
        if (response.status == 200 || response.status == 201) {
            let responseData = setCVDResponse(bundleData.bundle.entry, response.data.entry, "post");        //    
            res.status(201).json({ status: 1, message: "Practitioner data saved.", data: responseData })
        }
        else {
            return handleError(res, response)
        }
    }
    catch(error) {
        console.error("setCVDData Error: ", error)
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
            observation.module_type = "cvd";
            const transformedObservation = getTransformedResult(Observation, observation);
            return { ...observationData, ...transformedObservation };
        } catch (error) {
            console.warn(`Error processing observation: ${observation.id}`, error.message);
            return observationData; // Return original data if transformation fails
        }
    }).reduce((mergedData, data) => ({ ...mergedData, ...data }), observationData);
};


const getCVDObservationList = async (CVDEncounterList, practitionerList, mainEncounters, observations) => {
    try {
        return CVDEncounterList.map((encounter) => {
            let observationData = getTransformedResult(Encounter, encounter);

            // Add practitioner name
            observationData.practitionerName = getPractitionerName(observationData.practitionerId, practitionerList);

            // Add creation date
            observationData.createdOn = encounter.period.start;

            // Add appointment ID from main encounter
            const primaryEncounter = mainEncounters.find((e) => e.id === observationData.primaryEncounterId);
            observationData.appointmentId = primaryEncounter?.appointment?.[0]?.reference?.split("/")[1] || null;
            observationData.appointmentUuid = primaryEncounter?.identifier?.[0].value
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
        console.error("getCVDObservationList Error: ", error)
        throw error;
    }
}

const getCVDData = async (req, res) => {
    try {
        const queryParams = {
            _total : "accurate",
            _count: req.query._count,
            _offset: req.query._offset,
            _sort: req.query._sort,
            type: "cvd-encounter",
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
        
        // Extract cvd encounters and main encounters
        const cvdEncounterList = responseData.entry
        .filter((e) => e.resource.type?.[0]?.coding?.[0]?.code === CVD_ENCOUNTER_CODE)
        .map((e) => e.resource);
        
        const cvdEncounterIds = cvdEncounterList.map((e) => e.id).join(",");
        const mainEncounterIds = cvdEncounterList
        .map((e) => e.partOf?.reference?.split("/")[1])
        .filter(Boolean)
        .join(",");
        
        const [mainEncounterList, allObservations] = await Promise.all([
            fetchResource(RESOURCE_TYPES.ENCOUNTER, { _id: mainEncounterIds, _count: 10000 }),
            fetchResource(RESOURCE_TYPES.OBSERVATION, { encounter: cvdEncounterIds, _count: 100000 })
        ]);
            
        const mainEncounters = mainEncounterList.entry.map((e) => e.resource);
        const observations = allObservations.entry.map((e) => e.resource);
        
        // Process cvd encounters
        const resourceResult = await getCVDObservationList(cvdEncounterList, practitionerList, mainEncounters, observations);
                    
        const resStatus = bundleStructure.setResponse(resourceUrlData, responseData);
        
        res.status(200).json({
            status: resStatus,
            message: "Data fetched",
            total: resourceResult.length,
            data: resourceResult
        });
    } 
    catch(error) {
        console.error("getCVDData Error: ", error)
        return handleError(res, error)
    }
}

const patchToBundle = async(type, cvd, observation) => {
    try {
        const patchUrl = "Observation" + "/" + observation.id;
        const patchVal = {
            "encounterId": cvd.cvdFhirId,
            "op": cvd.component.operation,
            path: "/component", 
            value : observation.component
        }
        console.log("patch val: ", patchVal)
        const patchData = await bundleStructure.setBundlePatch([patchVal], patchUrl);
        return patchData
    }
    catch (error) {
        console.warn(`CVD '${type}' skipped:`, error.message);
        return null; // Return null for skipped CVD types
    }
}

const updateCVDData = async (req, res) => {
    try {
        // let response = resourceValid(req.params);
        // if (response.error) {
        //     console.error(response.error.details)
        //     let errData = { status: 0, response: { data: response.error.details }, message: "Invalid input" }
        //     return res.status(422).json(errData);
        // }
        let resourceResult = [];
        await Promise.all(req.body.map(async (cvd) => {
            let observations = await fetchResource(RESOURCE_TYPES.OBSERVATION, { "encounter": cvd.cvdFhirId, "code:text": cvd.key })
            let observation = getPatchComponent(cvd.key, cvd.component, observations.entry[0].resource);
            console.log("check patch data: ", observation.component)
            console.log("check observation here: ", observation)
            const patchData = await patchToBundle(cvd.key, cvd, observation);
            console.log("check observation patchData: ", patchData)
            let encounterPatchExist = resourceResult.find(e => e.fullUrl == "Encounter"+ "/"+ cvd.cvdFhirId);
                if(!encounterPatchExist){
                    let patchPractitionerRefInEncounter = await bundleFun.setBundlePatch([{
                        "op": "replace",
                        path: "/participant/0/individual/reference",
                        value : "Practitioner/" + req.token.userId,
                    },
                    {
                        "op": "replace",
                        path: "/length",
                        value : {
                            "value": new Date().valueOf(),
                            "unit": "millisecond",
                            "system": "https://unitsofmeasure.org",
                            "code": "ms"
                        },
                    }], "Encounter"+ "/"+ cvd.cvdFhirId);
                    resourceResult.push(patchPractitionerRefInEncounter);
                }
                resourceResult.push(patchData);
        }))
        console.log("CVD assessment Patch");

      const resourceData = {resourceResult: resourceResult, errData: []}
      let bundleData = await bundleStructure.getBundleJSON(resourceData)  
      console.info(bundleData)
    //   res.status(201).json({ status: 1, message: "CVD data saved.", data: bundleData.bundle })
      let response = await axios.post(config.baseUrl, bundleData.bundle); 
      console.log("get bundle json response: ", response.status)  
      if (response.status == 200 || response.status == 201) {
          let resourceResponse = setCVDResponse(bundleData.bundle.entry, response.data.entry, "patch");
          let responseData = [...resourceResponse, ...bundleData.errData];
          res.status(201).json({ status: 1, message: "CVD data saved.", data: responseData })
      }
      else {
          return handleError(res, response)
      }
    }  catch(error) {
        console.error("updateCVDData Error: ", error.data)
        return handleError(res, error)
    }
}



const setCVDResponse  = (reqBundleData, responseBundleData, type) => {
    let filteredData = [];
    let response = [];
    const responseData = bundleStructure.mapBundleService(reqBundleData, responseBundleData)
    if(["post", "POST"].includes(type)){
        filteredData = responseData.filter(e => e.resource.resourceType == "Encounter" && e.resource?.type?.[0]?.coding?.[0]?.code == "cvd-encounter");
    }
    else if(["patch", "PATCH"].includes(type)) {
        filteredData = responseData.filter(e => e.fullUrl.split("/")[0] == "Observation");
        
    }  
    response = responseService.setDefaultResponse("Encounter", type, filteredData)
    return response;
}

const {fhirTextToCVDType} = require("../utils/VitalObservationMap");

const getPatchComponent = (key, input, FHIRData) => {
const vitalType = fhirTextToCVDType[key];
  if (!vitalType) {
    console.warn(`Unknown FHIR code text: ${key}`);
    return FHIRData;
  }
  const obs = new Observation(input, FHIRData, vitalType);
  obs.setPatchData(); // internally calls component setter based on vitalType
  return obs.getFHIRResource();
}

module.exports = {saveCVDData, getCVDData, updateCVDData}