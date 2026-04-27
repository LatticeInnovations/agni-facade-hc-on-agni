const bundleStructure = require("../services/bundleOperation")
const responseService = require("../services/responseService");
let config = require("../config/nodeConfig");
const Observation = require("../class/CVDObservation");
const Encounter = require("../class/CVDEncounter");
let bundleFun = require("../services/bundleOperation");
let axios = require("axios");
const { fetchResource, handleError, getTransformedResult, getAPIPath } = require("../services/helperFunctions");
const { cvdSaveSchema, cvdPatchArraySchema } = require("../utils/Validator/cvdValidator");
const { validateRequest } = require("../utils/validateRequest")
const { fhirTextToCVDType } = require("../utils/VitalObservationMap");
const { createObservationBundle, createEncounterBundle, getPractitionerName, processObservationData } = require("../services/commonFunctions")
const { saveToken } = require("../services/email/tokenStore");
const { publishReportJob } = require("../middleware/reportPublisher");

const RESOURCE_TYPES = {
    ENCOUNTER: "Encounter",
    PRACTITIONER: "Practitioner",
    OBSERVATION: "Observation"
};

const CVD_ENCOUNTER_CODE = "cvd-encounter";
const CAMPAIGN_CVD_ENCOUNTER_CODE = "screening-site-cvd-encounter"

const cvdTypes = ["height", "weight", "bp", "cholesterol", "bmi", "diabetic", "smoker", "heartAttackHistory"];

const fetchMainEncounter = async (cvd, token, mainEncounterType) => {
    const mainEncounter = await fetchResource("Encounter", {
        appointment: cvd.appointmentId,
        _count: 5000,
        _include: "Encounter:appointment",
        type: mainEncounterType
    }, token);

    return mainEncounter
}

const fetchCVDEncounter = async (baseEncounterId, token, type) => {
    const result = await fetchResource("Encounter", { "part-of": baseEncounterId, type: type, _total: "accurate" }, token);
    return result;
}

function applyNonCampaignSideEffects(req) {
    req.queueMeta = {
        data: req.body,
        entity: "cvd",
        requestType: "post",
        apiName: "save-cvd",
        tokenData: req.decoded
    };
}


const saveCVDData = async (req, res) => {
    try {

        const isCampaignPath = await getAPIPath(req);
        console.log("check is it campaign path: ", isCampaignPath)

        const validatedBody = validateRequest(req.body, cvdSaveSchema, res);
        if (!validatedBody) return;

        if (!isCampaignPath) applyNonCampaignSideEffects(req);


        const token = req.accessToken;
        console.log("inside cvd")
       
        const allResourceResults = [], errData = [];
        await Promise.all(
            req.body.map(async (cvd) => {
                const resourceResult = [];
                const practitionerId = req.decoded.userId;
                console.log("check is campaign path: ", isCampaignPath)
                cvd.type = isCampaignPath ? CAMPAIGN_CVD_ENCOUNTER_CODE : CVD_ENCOUNTER_CODE;
                console.log("cvd.type: , ", cvd.type)
                const mainEncounterType = isCampaignPath ? "screening-site-main-encounter" : "facility-main-encounter";
                const encounterData = await fetchMainEncounter(cvd, token, mainEncounterType)
                const baseEncounterId = encounterData?.entry?.[0]?.resource?.id;
                const baseEncounter = encounterData?.entry?.[0]?.resource;
                if (!baseEncounterId) return;
                const cvdEncounter = await fetchCVDEncounter(baseEncounterId, token, cvd.type);
                //  copy location for campaign or routine checkup
                console.log("cvdEncounter: ==============>", cvdEncounter)
                if (cvdEncounter.total > 0 && cvdEncounter.entry) {
                    console.log("put case")
                    // Update case (PUT)
                    await handleExistingCVDEncounter({ cvd, cvdEncounter, baseEncounterId, practitionerId, resourceResult, token, baseEncounter });
                } else {
                    // Create case (POST)
                    console.log("post case")
                    const duplicateEncounterId = await checkDuplicateScreening(cvd, baseEncounterId, token);
                    if (duplicateEncounterId) {
                        console.log("duplicate screening case case")
                        errData.push({
                            status: 0,
                            "id": cvd.uuid,
                            "err": "Another appointment exists for the same screening date",
                            "fhirId": null
                        });
                        return;
                    }
                    await handleNewCVDEncounter({ cvd, baseEncounterId, practitionerId, resourceResult, baseEncounter});
                }

                allResourceResults.push(...resourceResult);
            })
        );

        const bundleData = await bundleStructure.getBundleJSON({
            resourceResult: allResourceResults, errData,
        });

        // return res.status(201).json({   status: 1,   message: "CVD data saved.",  data: allResourceResults });

        const response = await axios.post(config.baseUrl, bundleData.bundle, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/fhir+json'
            }
        });
        if ([200, 201].includes(response.status)) {
            const patientIds = [...new Set(req.body.map(cvd => cvd.patientId))];
            const resourceResponse = setCVDResponse(bundleData.bundle.entry, response.data.entry, "post");
            const responseData = [...resourceResponse, ...errData];
            await saveToken(token);
            for (const patientId of patientIds) {
                await publishReportJob(patientId);
            }
            return res.status(201).json({
                status: 1,
                message: "CVD data saved.",
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




const getCVDObservationList = async (CVDEncounterList, practitionerList, mainEncounters, token, isCampaignPath) => {
    try {
        console.log("CVDEncounterList: ", CVDEncounterList)
        const observationFinalData = await Promise.all(
            CVDEncounterList.map(async (encounter) => {
                const allObservations = await fetchResource("Observation", { encounter: encounter.id, _count: 20000 }, token)
                const observations = allObservations.entry.map((e) => e.resource);
                let observationData = getTransformedResult(Encounter, encounter);
                // Add practitioner name
                observationData.practitionerName = isCampaignPath ? null : getPractitionerName(observationData.practitionerId, practitionerList);

                // Add creation date
                observationData.createdOn = encounter.period.start;
                
                // Add appointment ID from main encounter
                const primaryEncounter = mainEncounters.find((e) => e.id === observationData.primaryEncounterId);
                observationData.appointmentId = primaryEncounter?.appointment?.[0]?.reference?.split("/")[1] || null;
                observationData.appointmentUuid = primaryEncounter?.identifier?.[0].value
                observationData.practitionerId = isCampaignPath ? null : observationData.practitionerId;
                observationData.roleId = isCampaignPath ? null : observationData.roleId;
                observationData.campaignId = isCampaignPath ? (encounter?.location?.[0]?.location?.reference.split("/")[1] ): null
                // Remove unnecessary fields
                delete observationData.primaryEncounterId;
                // delete observationData.practitionerId;
                console.log("observationData: ", observationData, "-----------")
                // Process observations for the encounter
                const observationList = observations.filter(
                    (obs) => obs.encounter.reference === `${RESOURCE_TYPES.ENCOUNTER}/${encounter.id}`
                );

                console.log("*********** observationList: ", observationList, "-----------")
                const observationResult = await processObservationData(observationList, observationData, "CVD", token);
                return observationResult;
            })
        )

        return observationFinalData;
    }
    catch (error) {
        console.error("getCVDObservationList Error: ", error)
        throw error;
    }
}

const getCVDData = async (req, res) => {
    try {
        const isCampaignPath = await getAPIPath(req);
        console.log("check is it campaign path: ", isCampaignPath)
        const encounter_code = isCampaignPath ? CAMPAIGN_CVD_ENCOUNTER_CODE : CVD_ENCOUNTER_CODE;
        const queryParams = {
            _total: "accurate",
            _count: req.query._count,
            _offset: req.query._offset,
            _sort: req.query._sort,
             type: encounter_code,
            _lastUpdated: req.query._lastUpdated
        }
        const token = req.accessToken;
        const link = config.baseUrl + RESOURCE_TYPES.ENCOUNTER;
        const resourceUrlData = { link, reqQuery: queryParams, allowNesting: 0, specialOffset: 1 };
        // Fetch resources in parallel
        const [responseData, practitionerData] = await Promise.all([
            fetchResource(RESOURCE_TYPES.ENCOUNTER, queryParams, token),
            fetchResource(RESOURCE_TYPES.PRACTITIONER, { _count: 100 }, token)
        ]);
        console.log("responseData: ", responseData)
        if (!responseData.entry || responseData.total == 0) {
            console.log("check here: ", queryParams)
            return res.status(200).json({ status: 2, message: "Data fetched", total: 0, data: [] })
        }
        const practitionerList = practitionerData.entry;
        // Extract cvd encounters and main encounters
        const cvdEncounterList = responseData.entry
            .filter((e) => e.resource.type?.[0]?.coding?.[0]?.code === encounter_code)
            .map((e) => e.resource);

        const mainEncounterIds = cvdEncounterList
            .map((e) => e.partOf?.reference?.split("/")[1])
            .filter(Boolean)
            .join(",");

        const mainEncounterList = await fetchResource(RESOURCE_TYPES.ENCOUNTER, { _id: mainEncounterIds, _count: 10000 }, token);

        const mainEncounters = mainEncounterList.entry.map((e) => e.resource);

       // Process cvd encounters
        const resourceResult = await getCVDObservationList(cvdEncounterList, practitionerList, mainEncounters, token, isCampaignPath);
        console.log("resourceResult: ", resourceResult)
        const resStatus = bundleStructure.setResponse(resourceUrlData, responseData);

        res.status(200).json({
            status: resStatus,
            message: "Data fetched",
            total: resourceResult.length,
            data: resourceResult
        });
    }
    catch (error) {
        console.error("getCVDData Error: ", error)
        return handleError(res, error)
    }
}

const patchToBundle = async (type, cvd, observation) => {
    try {
        const patchUrl = "Observation" + "/" + observation.id;
        const patchVal = {
            "encounterId": cvd.cvdFhirId,
            "op": cvd.component.operation,
            path: "/component",
            value: observation.component
        }
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
        const validatedBody = validateRequest(req.body, cvdPatchArraySchema, res);
        if (!validatedBody) return;
        const token = req.accessToken;
        let resourceResult = [];
        await Promise.all(req.body.map(async (cvd) => {
            let observations = await fetchResource(RESOURCE_TYPES.OBSERVATION, { "encounter": cvd.cvdFhirId, "code:text": cvd.key }, token)
            let observation = getPatchComponent(cvd.key, cvd.component, observations.entry[0].resource);
            const patchData = await patchToBundle(cvd.key, cvd, observation);
            let encounterPatchExist = resourceResult.find(e => e.fullUrl == "Encounter" + "/" + cvd.cvdFhirId);
            if (!encounterPatchExist) {
                let patchPractitionerRefInEncounter = await bundleFun.setBundlePatch([{
                    "op": "replace",
                    path: "/participant/0/individual/reference",
                    value: "Practitioner/" + req.token.userId,
                },
                {
                    "op": "replace",
                    path: "/length",
                    value: {
                        "value": new Date().valueOf(),
                        "unit": "millisecond",
                        "system": "https://unitsofmeasure.org",
                        "code": "ms"
                    },
                }], "Encounter" + "/" + cvd.cvdFhirId);
                resourceResult.push(patchPractitionerRefInEncounter);
            }
            resourceResult.push(patchData);
        }))
        console.log("CVD assessment Patch");

        const resourceData = { resourceResult: resourceResult, errData: [] }
        let bundleData = await bundleStructure.getBundleJSON(resourceData)
        console.info(bundleData)
        //   res.status(201).json({ status: 1, message: "CVD data saved.", data: bundleData.bundle })
        let response = await axios.post(config.baseUrl, bundleData.bundle, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/fhir+json'
            }
        });
        console.log("get bundle json response: ", response.status)
        if (response.status == 200 || response.status == 201) {
            let resourceResponse = setCVDResponse(bundleData.bundle.entry, response.data.entry, "patch");
            let responseData = [...resourceResponse, ...bundleData.errData];
            res.status(201).json({ status: 1, message: "CVD data saved.", data: responseData })
        }
        else {
            return handleError(res, response)
        }
    } catch (error) {
        console.error("updateCVDData Error: ", error.data)
        return handleError(res, error)
    }
}

async function handleExistingCVDEncounter({ cvd, cvdEncounter, baseEncounterId, practitionerId, resourceResult, token , baseEncounter}) {

    const existingEncounter = cvdEncounter.entry[0].resource;
    const observations = await fetchResource(RESOURCE_TYPES.OBSERVATION, {
        encounter: existingEncounter.id,
    }, token);
    const encounterBundle = await createEncounterBundle(Encounter, {
        encounterId: baseEncounterId,
        fhirId: existingEncounter.id,
        patientId: cvd.patientId,
        uuid: existingEncounter.identifier?.[0]?.value || cvd.uuid,
        reqUuid: cvd.uuid,
        practitionerId,
        generatedOn: cvd.createdOn,
        screeningDate: cvd.screeningDate,
        chiefComplaint: cvd.chiefComplaint,
        type: cvd.type
    }, "put");
    console.log("check the base encounter: ", baseEncounter)
    encounterBundle.resource.location = baseEncounter?.location || null;
    encounterBundle.resource.individual = baseEncounter.individual;
    encounterBundle.resource.serviceProvider = baseEncounter?.serviceProvider || null;
    encounterBundle.resource.participant = baseEncounter?.participant || null;
    resourceResult.push(encounterBundle);

    Object.assign(cvd, {
        encounterId: existingEncounter.id,
        practitionerId,
        categoryCode: "CVD",
        categoryDisplay: "CVD risk assessment",
    });

    const observationBundles = await Promise.all(
        cvdTypes.map((type) => {
            const matchingObservation = observations.entry?.find(
                e => fhirTextToCVDType[e.resource.code.text] === type
            );
            if (!matchingObservation) return null;

            cvd.fhirId = matchingObservation.resource.id;
            return createObservationBundle(cvd, type, "put", "CVD");
        })
    );

    resourceResult.push(...observationBundles.filter(Boolean));
}


async function handleNewCVDEncounter({ cvd, baseEncounterId, practitionerId, resourceResult, baseEncounter }) {
    const encounterBundle = await createEncounterBundle(Encounter, {
        encounterId: baseEncounterId,
        patientId: cvd.patientId,
        uuid: cvd.uuid,
        reqUuid: cvd.uuid,
        practitionerId,
        generatedOn: cvd.createdOn,
        screeningDate: cvd.screeningDate,
        chiefComplaint: cvd.chiefComplaint,
        type: cvd.type
    }, "post");
    console.log("baseEncounter: ", baseEncounter)
    encounterBundle.resource.location = baseEncounter?.location || null;
    encounterBundle.resource.individual = baseEncounter.individual;
    encounterBundle.resource.serviceProvider = baseEncounter?.serviceProvider || null;
    encounterBundle.resource.participant = baseEncounter?.participant || null;
    resourceResult.push(encounterBundle);

    Object.assign(cvd, {
        encounterId: cvd.uuid,
        practitionerId,
        categoryCode: "CVD",
        categoryDisplay: "CVD risk assessment",
    });

    const observationBundles = await Promise.all(
        cvdTypes.map((type) => createObservationBundle(cvd, type, "post", "CVD"))
    );

    resourceResult.push(...observationBundles.filter(Boolean));
}


const checkDuplicateScreening = async (cvd, baseEncounterId, token, isCampaignPath) => {
    const resources = await fetchResource("Encounter", {
        patient: cvd.patientId,
        type: isCampaignPath ? "screening-site-cvd-encounter": "cvd-encounter",
        _total: "accurate",
        _count: 2000,
    }, token);

    if (resources.total > 0 && resources.entry) {
        const matchingEntry = resources.entry.find(e =>
            e.resource.extension?.some(ext =>
                new Date(ext.valueDateTime).toISOString().split("T")[0] === cvd.screeningDate
            ) && e.resource.partOf.reference.split("/")[1] != baseEncounterId
        );

        if (matchingEntry) {
            return matchingEntry.resource.id; // ✅ return existing encounter ID
        }
    }

    return null;
};




const setCVDResponse = (reqBundleData, responseBundleData, type) => {
    let filteredData = [];
    let response = [];
    const responseData = bundleStructure.mapAssessmentBundleService(reqBundleData, responseBundleData)
    if (["post", "POST", "put", "PUT"].includes(type)) {
        filteredData = responseData.filter(e => e.resource.resourceType == "Encounter" && (e.resource?.type?.[0]?.coding?.[0]?.code == "cvd-encounter" || e.resource?.type?.[0]?.coding?.[0]?.code == "screening-site-cvd-encounter"));
    }
    else if (["patch", "PATCH"].includes(type)) {
        filteredData = responseData.filter(e => e.fullUrl.split("/")[0] == "Observation");

    }
    response = responseService.setDefaultAssessmentResponse("Encounter", type, filteredData)
    return response;
}





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

module.exports = { saveCVDData, getCVDData, updateCVDData }