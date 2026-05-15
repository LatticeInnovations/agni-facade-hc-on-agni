const bundleStructure = require("../services/bundleOperation")
const responseService = require("../services/responseService");
let config = require("../config/nodeConfig");
const Condition = require("../class/PriorDxCondition");
const Encounter = require("../class/PriorDXEncounter");
let bundleFun = require("../services/bundleOperation");
let axios = require("axios");
const {fetchResource, handleError, getTransformedResult, buildFHIRResource, getAPIPath} = require("../services/helperFunctions");
const {validateRequest} = require("../utils/validateRequest")
const {priorDxArraySchema} = require("../utils/Validator/prioDxValidator")
const { v4: uuidv4 } = require('uuid');
const { publishReportJob } = require("../middleware/reportPublisher");
const { saveToken } = require("../services/email/tokenStore");


const CAMPAIGN_PRIOR_DX_ENCOUNTER_CODE = "screening-site-priorDx-encounter";
const PRIOR_DX_ENCOUNTER_CODE = "priorDx-encounter";


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
  
const fetchMainEncounter = async (priorDx, token, mainEncounterType) => {
   const mainEncounter =   await fetchResource(RESOURCE_TYPES.ENCOUNTER, {
        appointment: priorDx.appointmentId,
        _count: 5000,
        _include: "Encounter:appointment",
        type: mainEncounterType
    }, token );

    return mainEncounter
}

const fetchPriorDxEncounter = async (baseEncounterId, token, type) => {
    const result =  await fetchResource("Encounter", {  "part-of": baseEncounterId, type: type, _total: "accurate"}, token);
    return result;
 }

 function applyNonCampaignSideEffects(req) {
    req.queueMeta = {
        data: req.body,
        entity: "priorDx",
        requestType: "post",
        apiName: "save-priorDx",
        tokenData: req.decoded
      };
}


const savePriorDxData = async (req, res) => {
    try {

        const isCampaignPath = await getAPIPath(req);
        console.log("check is it campaign path: ", isCampaignPath)

        const validatedBody = validateRequest(req.body, priorDxArraySchema, res);
        if (!validatedBody) return;

        if (!isCampaignPath) applyNonCampaignSideEffects(req);
        const mainEncounterType = isCampaignPath ? "screening-site-main-encounter" : "facility-main-encounter";
        const subEncounterType = isCampaignPath ? CAMPAIGN_PRIOR_DX_ENCOUNTER_CODE : PRIOR_DX_ENCOUNTER_CODE;
       const token = req.accessToken;
        const allResourceResults = [], errData = [];
        await Promise.all(
            req.body.map(async (priorDxData) => {
                const resourceResult = [];
                priorDxData.type = subEncounterType
                const practitionerId = req.decoded.userId;
                const encounterData = await fetchMainEncounter(priorDxData, token, mainEncounterType)
                const baseEncounterId = encounterData?.entry?.[0]?.resource?.id;
                const baseEncounter = encounterData?.entry?.[0]?.resource;
                if (!baseEncounterId) return;

                const priorDxEncounter = await fetchPriorDxEncounter(baseEncounterId, token, priorDxData.type)
                
                if (priorDxEncounter.total > 0 && priorDxEncounter.entry) {
                    // Update case (PUT)
                      await handleExistingPriorDx({priorDxData, priorDxEncounter, baseEncounterId, practitionerId, resourceResult}, token, baseEncounter);
                } else {
                    // Create case (POST)
                    console.log("post case")
                    await handleNewPriorDx({priorDxData, priorDxEncounter, baseEncounterId, practitionerId, resourceResult, baseEncounter});
                }

                allResourceResults.push(...resourceResult);
            })
        );

        const bundleData = await bundleStructure.getBundleJSON({ resourceResult: allResourceResults, errData });

        // return res.status(201).json({   status: 1,   message: "Prior data saved.",  data: bundleData });

        const response = await axios.post(config.baseUrl, bundleData.bundle, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/fhir+json'
            }
        });
        if ([200, 201].includes(response.status)) {       
            const patientIds = [...new Set(req.body.map(cvd => cvd.patientId))];
            const resourceResponse = setPriorDxResponse(bundleData.bundle.entry, response.data.entry, "post", subEncounterType);
            const responseData = [...resourceResponse, ...errData];  
            const fhirIds = responseData.map(item => item.fhirId); 
            await saveToken(token);
            for (const patientId of patientIds) {
                await publishReportJob(patientId, fhirIds);
            }     
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
        const isCampaignPath = await getAPIPath(req);
        console.log("check is it campaign path: ", isCampaignPath)
        const encounter_code = isCampaignPath ? CAMPAIGN_PRIOR_DX_ENCOUNTER_CODE : PRIOR_DX_ENCOUNTER_CODE;
        const queryParams = {
                    _total : "accurate",
                    _count: req.query._count,
                    _offset: req.query._offset,
                    _sort: req.query._sort,
                    type: encounter_code,
                    _lastUpdated: req.query._lastUpdated
                }
        const link = config.baseUrl + RESOURCE_TYPES.ENCOUNTER;
        const token = req.accessToken;
        const resourceUrlData = { link, reqQuery: queryParams, allowNesting: 0, specialOffset: 1 };
        // Fetch resources in parallel
        const [responseData, practitionerData] = await Promise.all([
            fetchResource("Encounter", queryParams, token),
            fetchResource("Practitioner", { _count: 10000 }, token)
        ]);
        if( !responseData.entry || responseData.total == 0) {
            return res.status(200).json({ status: 2, message: "Data fetched", total: 0, data: []  })
        }
                const practitionerList = practitionerData.entry;
                
                // Extract cvd encounters and main encounters
                const priorDxEncounterList = responseData.entry
                .filter((e) => e.resource.type?.[0]?.coding?.[0]?.code === encounter_code)
                .map((e) => e.resource);
                
                const priorDxEncounterIds = priorDxEncounterList.map((e) => e.id).join(",");
                const mainEncounterIds = priorDxEncounterList
                .map((e) => e.partOf?.reference?.split("/")[1])
                .filter(Boolean)
                .join(",");
                const mainEncounterList = await fetchResource("Encounter", { _id: mainEncounterIds, _count: 10000 }, token)
                    
                const mainEncounters = mainEncounterList.entry.map((e) => e.resource);
                
                // Process priorDx encounters
                const resourceResult = await getConditionList(priorDxEncounterList, practitionerList, mainEncounters, token, isCampaignPath);
                            
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

const getConditionList = async (priorDxEncounterList, practitionerList, mainEncounters, token, isCampaignPath) => {
    try {
                console.log("practitionerList: ", practitionerList)  
        return Promise.all(
            priorDxEncounterList.map(async (encounter) => {
                let conditionData = getTransformedResult(Encounter, encounter);
                    const allConditions = await fetchResource("Condition", { encounter: encounter.id, _count: 100000 }, token)
                    const conditions = allConditions.entry.map((e) => e.resource);
                // Add practitioner name
                conditionData.practitionerName = isCampaignPath ? null : getPractitionerName(conditionData.practitionerId, practitionerList);
    
                // Add creation date
                conditionData.createdOn = encounter.period.start;
    
                // Add appointment ID from main encounter
                const primaryEncounter = mainEncounters.find((e) => e.id === conditionData.primaryEncounterId);
                conditionData.appointmentId = primaryEncounter?.appointment?.[0]?.reference?.split("/")[1] || null;
                conditionData.appointmentUuid = primaryEncounter?.identifier?.[0].value
                conditionData.practitionerName = getPractitionerName(conditionData.practitionerId, practitionerList);
                // Remove unnecessary fields
                delete conditionData.primaryEncounterId;
                conditionData.roleId = isCampaignPath ? null : conditionData.roleId;
                conditionData.campaignId = isCampaignPath ? (encounter?.location?.[0]?.location?.reference.split("/")[1] ): null
    
                // Process observations for the encounter
                const conditionList = conditions.filter(
                    (obs) => obs.encounter.reference === `${RESOURCE_TYPES.ENCOUNTER}/${encounter.id}`
                );
                conditionData = processConditionData(conditionList, conditionData, "priorDx");
    
                return conditionData;
            })
        )

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
        encounter.uuid = encounterData.reqUuid
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

async function handleExistingPriorDx({ priorDxData, priorDxEncounter, baseEncounterId, practitionerId, resourceResult}, token, baseEncounter) {

    const existingEncounter = priorDxEncounter.entry[0].resource;
    const conditions = await fetchResource(RESOURCE_TYPES.CONDITION, {
        encounter: existingEncounter.id,
        _count: 2000
    }, token);

    const encounterBundle = await createEncounterBundle(Encounter, {
        encounterId: baseEncounterId,
        fhirId: existingEncounter.id,
        patientId: priorDxData.patientId,
        uuid: existingEncounter.identifier?.[0]?.value || priorDxData.uuid,
        reqUuid: priorDxData.uuid,
        practitionerId,
        generatedOn: priorDxData.appUpdatedDate,
        type: priorDxData.type
    }, "put");

    encounterBundle.resource.location = baseEncounter?.location || null;
    encounterBundle.resource.individual = baseEncounter.individual;
    encounterBundle.resource.serviceProvider = baseEncounter?.serviceProvider || null;
    encounterBundle.resource.participant = baseEncounter?.participant || null;

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


async function handleNewPriorDx({ priorDxData, baseEncounterId, practitionerId, resourceResult, baseEncounter }) {
    try {
        const encounterBundle = await createEncounterBundle(Encounter, {
            encounterId: baseEncounterId,
            patientId: priorDxData.patientId,
            uuid: priorDxData.uuid,
            reqUuid: priorDxData.uuid,
            practitionerId: practitionerId,
            generatedOn: priorDxData.appUpdatedDate,
            type: priorDxData.type
        }, "post");

        encounterBundle.resource.location = baseEncounter?.location || null;
        encounterBundle.resource.individual = baseEncounter.individual;
        encounterBundle.resource.serviceProvider = baseEncounter?.serviceProvider || null;
        encounterBundle.resource.participant = baseEncounter?.participant || null;
    
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




const setPriorDxResponse  = (reqBundleData, responseBundleData, type, subEncounterType) => {
    let filteredData = [];
    let response = [];
    const responseData = bundleStructure.mapAssessmentBundleService(reqBundleData, responseBundleData)
    if(["post", "POST", "put", "PUT"].includes(type)){
        filteredData = responseData.filter(e => e.resource.resourceType == "Encounter" && e.resource?.type?.[0]?.coding?.[0]?.code == subEncounterType);
    }
    else if(["patch", "PATCH"].includes(type)) {
        filteredData = responseData.filter(e => e.fullUrl.split("/")[0] == "Condition");
        
    }  
    response = responseService.setDefaultAssessmentResponse("Encounter", type, filteredData)
    return response;
}



module.exports = {savePriorDxData, getPriorDxData, reverseCodeMap}