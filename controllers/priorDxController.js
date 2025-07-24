const bundleStructure = require("../services/bundleOperation")
const responseService = require("../services/responseService");
let config = require("../config/nodeConfig");
const Condition = require("../class/PriorDxCondition");
const Encounter = require("../class/PriorDXEncounter");
let bundleFun = require("../services/bundleOperation");
let axios = require("axios");
const {fetchResource, handleError, getTransformedResult, buildFHIRResource} = require("../services/helperFunctions");
const {validateRequest} = require("../utils/validateRequest")
const {priorDxArraySchema} = require("../utils/Validator/prioDxValidator")
const { v4: uuidv4 } = require('uuid');

 const RESOURCE_TYPES = {
    ENCOUNTER: "Encounter",
    CONDITION: "Condition"
};

const HTTP_METHODS = {
    POST: "POST",
    GET: "GET"
}

const BUNDLE_TYPES = {
    IDENTIFIER: "identifier"
}

const reverseCodeMap = {
    hasHypertension: {
      code: "38341003",
      display: "Hypertension"
    },
    hasAsthma: {
      code: "195967001",
      display: "Asthma"
    },
    hasHeartDiseases: {
      code: "5626500",
      display: "Heart attack/ angina/ other heart disease"
    },
    hasChronicObstructivePulmonaryDisease: {
      code: "13645005",
      display: "Chronic obstructive pulmonary disease (COPD)"
    },
    hasTransientIschaemicAttack: {
      code: "266257000",
      display: "Transient ischaemic attack (TIA)"
    },
    hasChronicKidneyDiseases: {
      code: "709044004",
      display: "Chronic kidney disease"
    },
    hasDiabetes: {
      code: "73211009",
      display: "Diabetes"
    },
    hasTuberculosis: {
      code: "56717001",
      display: "Tuberculosis"
    },
    hasHypercholesterolaemia: {
      code: "13644009",
      display: "Hypercholesterolaemia"
    },
    hasAids: {
      code: "62479008",
      display: "AIDS"
    },
    hasCancer: {
      code: "1240414004",
      display: "Cancer",
      getText: (obj) => obj.cancer
    },
    hasOthers: {
      code: "74964007",
      display: "Others",
      getText: (obj) => obj.others
    },
    hasCovid: {
      code: "840539006",
      display: "COVID-19"
    }
  };
  
const fetchMainEncounter = async (priorDx) => {
   const mainEncounter =   await fetchResource(RESOURCE_TYPES.ENCOUNTER, {
        appointment: priorDx.appointmentId,
        _count: 5000,
        _include: "Encounter:appointment",
    });

    console.log(mainEncounter)

    return mainEncounter
}

const fetchPriorDxEncounter = async (baseEncounterId) => {
    const result =  await fetchResource("Encounter", {  "part-of": baseEncounterId, type: "priorDx-encounter", _total: "accurate"});
    return result;
 }


const savePriorDxData = async (req, res) => {
    try {
        const validatedBody = validateRequest(req.body, priorDxArraySchema, res);
        if (!validatedBody) return;
        req.queueMeta = {
            data: req.body,
            entity: "priorDx",
            requestType: "post",
            apiName: "save-priorDx",
            tokenData: req.decoded
          };
        console.log("inside priorDx")
        const allResourceResults = [], errData = [];
        await Promise.all(
            req.body.map(async (priorDxData) => {
                const resourceResult = [];
                const practitionerId = req.decoded.userId;
                const encounterData = await fetchMainEncounter(priorDxData)
                const baseEncounterId = encounterData?.entry?.[0]?.resource?.id;
                if (!baseEncounterId) return;

                const priorDxEncounter = await fetchPriorDxEncounter(baseEncounterId)
                console.log("cvdEncounter check: ", priorDxEncounter)
                
                if (priorDxEncounter.total > 0) {
                    // Update case (PUT)
                      console.log("Inside PUT request")
                      await handleExistingPriorDx({priorDxData, priorDxEncounter, baseEncounterId, practitionerId, resourceResult});
                } else {
                    // Create case (POST)
                    console.log("post case")
                    await handleNewPriorDx({priorDxData, priorDxEncounter, baseEncounterId, practitionerId, resourceResult});
                }
                console.log("resourceResult: ", resourceResult)

                allResourceResults.push(...resourceResult);
            })
        );

        const bundleData = await bundleStructure.getBundleJSON({ resourceResult: allResourceResults, errData });

        // return res.status(201).json({   status: 1,   message: "Prior data saved.",  data: bundleData });

        const response = await axios.post(config.baseUrl, bundleData.bundle);
        console.log("response: ", response.data, "---------------------")
        if ([200, 201].includes(response.status)) {            
            const resourceResponse = setPriorDxResponse(bundleData.bundle.entry, response.data.entry, "post");
            const responseData = [...resourceResponse, ...errData];   
            return res.status(201).json({
                status: 1,
                message: "PriorDx data saved.",
                data: responseData,
            });
        }

        return handleError(res, response);
    } catch (error) {
        console.error("setCVDData Error: ", error);
        return handleError(res, error);
    }
};


// Process observation data and merge with encounter data.


const getPriorDxData = async (req, res) => {
    try {
        console.log("GET section")
        const queryParams = {
                    _total : "accurate",
                    _count: req.query._count,
                    _offset: req.query._offset,
                    _sort: req.query._sort,
                    type: "priorDx-encounter"
                }
        const link = config.baseUrl + RESOURCE_TYPES.ENCOUNTER;
        const resourceUrlData = { link, reqQuery: queryParams, allowNesting: 0, specialOffset: 1 };
        // Fetch resources in parallel
        const [responseData, practitionerData] = await Promise.all([
            fetchResource("Encounter", queryParams),
            fetchResource("Practitioner", { _count: 10000 })
        ]);
        if( !responseData.entry || responseData.total == 0) {
            return res.status(200).json({ status: 2, message: "Data fetched", total: 0, data: []  })
        }
                const practitionerList = practitionerData.entry;
                
                // Extract cvd encounters and main encounters
                const priorDxEncounterList = responseData.entry
                .filter((e) => e.resource.type?.[0]?.coding?.[0]?.code === "priorDx-encounter")
                .map((e) => e.resource);
                
                const priorDxEncounterIds = priorDxEncounterList.map((e) => e.id).join(",");
                const mainEncounterIds = priorDxEncounterList
                .map((e) => e.partOf?.reference?.split("/")[1])
                .filter(Boolean)
                .join(",");
                console.log('priorDxEncounterIds: ', priorDxEncounterIds)
                const [mainEncounterList, allConditions] = await Promise.all([
                    fetchResource("Encounter", { _id: mainEncounterIds, _count: 10000 }),
                    fetchResource("Condition", { encounter: priorDxEncounterIds, _count: 100000 })
                ]);
                    
                const mainEncounters = mainEncounterList.entry.map((e) => e.resource);
                const conditions = allConditions.entry.map((e) => e.resource);
                
                // Process priorDx encounters
                const resourceResult = await getConditionList(priorDxEncounterList, practitionerList, mainEncounters, conditions);
                            
                const resStatus = bundleStructure.setResponse(resourceUrlData, responseData);
        
        return res.status(200).json({
            status: resStatus,
            message: "Data fetched",
            total: resourceResult.length,
            data: resourceResult
        });
    } 
    catch(error) {
        console.error("getPriorDxData Error: ", error)
        return handleError(res, error)
    }
}

const getPractitionerName = (practitionerId, practitionerData) => {
    const practitioner = practitionerData.find((e) => e?.resource?.id === practitionerId);

    if (!practitioner) return "";

    const givenName = practitioner?.resource?.name?.[0]?.given?.join(" ") || "";
    const familyName = practitioner?.resource?.name?.[0]?.family || "";
    return `${givenName} ${familyName}`.trim();
};

const getConditionList = async (priorDxEncounterList, practitionerList, mainEncounters, conditions) => {
    try {
        return priorDxEncounterList.map((encounter) => {
            let conditionData = getTransformedResult(Encounter, encounter);

            // Add practitioner name
            conditionData.practitionerName = getPractitionerName(conditionData.practitionerId, practitionerList);

            // Add creation date
            conditionData.createdOn = encounter.period.start;

            // Add appointment ID from main encounter
            const primaryEncounter = mainEncounters.find((e) => e.id === conditionData.primaryEncounterId);
            conditionData.appointmentId = primaryEncounter?.appointment?.[0]?.reference?.split("/")[1] || null;
            conditionData.appointmentUuid = primaryEncounter?.identifier?.[0].value
            // Remove unnecessary fields
            delete conditionData.primaryEncounterId;
            conditionData.practitionerId;

            // Process observations for the encounter
            const conditionList = conditions.filter(
                (obs) => obs.encounter.reference === `${RESOURCE_TYPES.ENCOUNTER}/${encounter.id}`
            );
            conditionData = processConditionData(conditionList, conditionData, "priorDx");

            return conditionData;
        });
    }
    catch(error) {
        console.error("getCVDObservationList Error: ", error)
        throw error;
    }
}

const processConditionData = (conditionList, conditionData, module_type) => {
    return conditionList.map((condition) => {
        try {
            // Dynamically transform the observation using the helper function
            condition.module_type = module_type;
            const transformedCondition = getTransformedResult(Condition, condition);
            console.log("transformedCondition: =====>>>>", transformedCondition)
            return { ...conditionData, ...transformedCondition };
        } catch (error) {
            console.warn(`Error processing condition: ${condition.id}`, error.message);
            return conditionData; // Return original data if transformation fails
        }
    }).reduce((mergedData, data) => ({ ...mergedData, ...data }), conditionData);
};

const createEncounterBundle = async(EncounterClass, encounterData, requestType) => {
    try {
        const encounter = buildFHIRResource(EncounterClass, encounterData);
        encounter.appointment = null
        console.log("encounter data: ", encounter)
        if(requestType == "post") {
            return await bundleStructure.setBundlePost(encounter, null, encounterData.uuid, HTTP_METHODS.POST, BUNDLE_TYPES.IDENTIFIER);
        }            
        else {
            encounter.id = encounterData.fhirId;
            return await bundleStructure.setBundlePut(encounter, null, encounterData.fhirId, HTTP_METHODS.POST, BUNDLE_TYPES.IDENTIFIER);
        }
            
    }
    catch (error) {
        console.error(`createEncounterBundle Error:`, error.message);
        throw error;
    }
}

async function handleExistingPriorDx({ priorDxData, priorDxEncounter, baseEncounterId, practitionerId, resourceResult}) {

    const existingEncounter = priorDxEncounter.entry[0].resource;
    const conditions = await fetchResource(RESOURCE_TYPES.CONDITION, {
        encounter: existingEncounter.id,
    });

    const encounterBundle = await createEncounterBundle(Encounter, {
        encounterId: baseEncounterId,
        fhirId: existingEncounter.id,
        patientId: priorDxData.patientId,
        uuid: existingEncounter.identifier?.[0]?.value || priorDxData.uuid,
        practitionerId,
        generatedOn: priorDxData.appUpdatedDate
    }, "put");

    resourceResult.push(encounterBundle);

    Object.assign(priorDxData, {
        encounterId: priorDxData.uuid,
        practitionerId,
        categoryCode: "priorDx",
        categoryDisplay: "priorDx",
    });

    const conditionBundles = await Promise.all(
        Object.entries(reverseCodeMap).map(([key, type]) =>  {
            const matchingCondition = conditions.entry?.find(
                e => e.resource.code.coding[0].code === type.code
            );
            if (!matchingCondition) return null;
            return createConditionResource({practitionerId, encounterId: "Encounter/" + existingEncounter.id, key, ...type, createdOn: priorDxData.appUpdatedDate, booleanValue: priorDxData[key], patientId: priorDxData.patientId, textValue: (key == "hasCancer" ? priorDxData["cancer"] : (key == "hasOthers"? priorDxData["others"]: null )), fhirId:  matchingCondition.resource.id}, "put")
        }))

        resourceResult.push(...conditionBundles.filter(Boolean));
}


async function handleNewPriorDx({ priorDxData, baseEncounterId, practitionerId, resourceResult }) {
    try {
        const encounterBundle = await createEncounterBundle(Encounter, {
            encounterId: baseEncounterId,
            patientId: priorDxData.patientId,
            uuid: priorDxData.uuid,
            practitionerId: practitionerId,
            generatedOn: priorDxData.appUpdatedDate
        }, "post");
    
        resourceResult.push(encounterBundle);
    
        Object.assign(priorDxData, {
            encounterId: priorDxData.uuid,
            practitionerId,
            categoryCode: "priorDx",
            categoryDisplay: "priorDx",
        });
    
        const conditionBundles = await Promise.all(
            Object.entries(reverseCodeMap).map(([key, type]) => createConditionResource({practitionerId, encounterId: "urn:uuid:" + priorDxData.uuid, key, ...type, createdOn: priorDxData.appUpdatedDate, booleanValue: priorDxData[key], patientId: priorDxData.patientId, textValue: (key == "hasCancer" ? priorDxData["cancer"] : (key == "hasOthers"? priorDxData["others"]: null )) }, "post")
        ));
        resourceResult.push(...conditionBundles)
    }
    catch(error) {
        console.error("handleNewPriorDx error: ", error);
        throw error;
    }
}

const createConditionResource = async(resourceData, requestType) => {
    try {
        resourceData.module_type = "CVD";
        resourceData.uuid = uuidv4();
        const resource = buildFHIRResource(Condition, { ...resourceData});        
        if(requestType == "post") {
            return await bundleStructure.setBundlePost(resource, null, resourceData.uuid, HTTP_METHODS.POST, BUNDLE_TYPES.IDENTIFIER);
        }            
        else {
            resource.id = resourceData.fhirId;
            return await bundleStructure.setBundlePut(resource, null, resource.id, "PUT", BUNDLE_TYPES.IDENTIFIER);
        }
    }
    catch (error) {
        console.warn(`PriorDx skipped:`, error.message);
        return null; // Return null for skipped CVD types
    }
}




const setPriorDxResponse  = (reqBundleData, responseBundleData, type) => {
    let filteredData = [];
    let response = [];
    // console.log("reqBundleData: ", reqBundleData, "and responseBundleData",  responseBundleData)
    const responseData = bundleStructure.mapAssessmentBundleService(reqBundleData, responseBundleData)
    if(["post", "POST", "put", "PUT"].includes(type)){
        filteredData = responseData.filter(e => e.resource.resourceType == "Encounter" && e.resource?.type?.[0]?.coding?.[0]?.code == "priorDx-encounter");
    }
    else if(["patch", "PATCH"].includes(type)) {
        filteredData = responseData.filter(e => e.fullUrl.split("/")[0] == "Condition");
        
    }  
    response = responseService.setDefaultResponse("Encounter", type, filteredData)
    return response;
}



module.exports = {savePriorDxData, getPriorDxData}