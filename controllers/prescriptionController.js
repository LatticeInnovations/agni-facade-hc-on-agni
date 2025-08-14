
const MedicationRequest = require("../class/MedicationRequest");
const Encounter = require("../class/GroupEncounter")
const AppointmentEncounter = require("../class/BaseEncounter")
let axios = require("axios");
let config = require("../config/nodeConfig");
const bundleStructure = require("../services/bundleOperation")
const responseService = require("../services/responseService");
const { buildFHIRResource, handleError, fetchResource, getTransformedResult } = require("../services/helperFunctions");
const { prescriptionArraySchema } = require("../utils/Validator/prescriptionValidator");
const {validateRequest} = require("../utils/validateRequest");
const configUrls = require("../utils/heartcareSystemUrl")


const HTTP_METHODS = {
    POST: "POST",
    PUT: "PUT"
};

const BUNDLE_TYPES = {
    IDENTIFIER: "identifier"
};


const createEncounterBundle = async (patPres, apptData, token) => {
    patPres.uuid = patPres.prescriptionId;
    patPres.code = "prescription-encounter-form";
    patPres.display = "Prescription management";
    patPres.appointmentEncounterId = apptData.id;
    patPres.userId = token.userId;
    const encounterData = buildFHIRResource(Encounter, patPres);
    encounterData.uuid =  patPres.uuid
    return await bundleStructure.setBundlePost(
        encounterData,
        encounterData.identifier,
        patPres.uuid,
        HTTP_METHODS.POST,
        BUNDLE_TYPES.IDENTIFIER
    );
};

const createMedicationRequestBundle = async (prescription, patPres, encounterData, type) => {
    console.log("patPres: ", patPres)
    const dateToday = new Date(patPres.generatedOn).getTime().toString();
    const lastDigits = dateToday.slice(9, -1);
    const grpIdentify = lastDigits + patPres.patientId;

    prescription.patientId = patPres.patientId;
    prescription.generatedOn = patPres.generatedOn;
    prescription.prescriptionId = patPres.prescriptionId;
    prescription.encounterId = (type == "post" &&  patPres.subEncounterId || type == "put") ?"Encounter/" + patPres.subEncounterId : "urn:uuid:" + patPres.uuid;
    prescription.grpIdentify = grpIdentify;
    prescription.identifier = [
        {
            system: configUrls.medReqUuidUrl,
            value: prescription.medReqUuid
        },
        ...encounterData.identifier
    ];

    const medReqData = buildFHIRResource(MedicationRequest, prescription);
    medReqData.reqUuid = prescription.reqUuid;
    if(type == "post") {
        return await bundleStructure.setBundlePost(
            medReqData,
            prescription.identifier,
            prescription.medReqUuid,
            HTTP_METHODS.POST,
            BUNDLE_TYPES.IDENTIFIER
        );
    }
    else {
        return await bundleStructure.setBundlePut(
            medReqData,
            null,
            prescription.medReqFhirId,
            HTTP_METHODS.PUT,
            BUNDLE_TYPES.IDENTIFIER
        );
    }

 
};

//  Save prescription data
let savePrescriptionData = async function (req, res) {
    try {
        const validatedBody = validateRequest(req.body, prescriptionArraySchema, res);
        if (!validatedBody) return;
        const token = req.accessToken;
        const resourceResult = await Promise.all(
            req.body.map(async (patPres) => {
                try {
                    // Fetch appointment encounter
                    const appointmentEncounter = await fetchResource("Encounter", {  appointment: patPres.appointmentId, _count: 5000, _include: "Encounter:appointment"}, token);
                    const apptData = appointmentEncounter.entry[0].resource;
                    // Check if encounter of prescription already exists
                    const prescriptionEncounter =  await fetchResource("Encounter", {  "part-of": appointmentEncounter.entry[0].resource.id, type: "prescription-encounter-form", _total: "accurate"}, token);
                    // Create encounter bundle
                    if (prescriptionEncounter.total > 0 && prescriptionEncounter.entry) {
                       return await updatePrescription(prescriptionEncounter.entry[0].resource, patPres, token, req.decoded)
                    }
                    else {
                        return await createPrescriptionResources(apptData, patPres, req.decoded)
                    }

                } catch (error) {
                    console.warn(`Error processing prescription: ${patPres.prescriptionId}`, error);
                    return []; // Return empty array for skipped prescriptions
                }
            })
        );
        // Flatten the resource results
        console.log(resourceResult)
        const flattenedResourceResult = resourceResult.flat();

        // Create bundle and send request   
        const bundleData = await bundleStructure.getBundleJSON({ resourceResult: flattenedResourceResult });
        // return res.status(201).json({ status: 1, message: "Update Prescription stopped", data: bundleData.bundle });
        const response = await axios.post(config.baseUrl, bundleData.bundle, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/fhir+json'
            }
        });
        console.info("get bundle json response: ", response.status);

        if (response.status === 200 || response.status === 201) {
            const responseData = setPrescriptionResponse(bundleData.bundle.entry, response.data.entry, "post");
            return res.status(201).json({ status: 1, message: "Prescription data saved.", data: responseData });
        } else {
            return handleError(res, response);
        }
    } catch (error) {
        console.error("savePrescriptionData Error: ", error);
        return handleError(res, error);
    }
};

const updatePrescription = async (prescriptionEncounter, patPres, token, decoded) => {
    // update section 
    prescriptionEncounter.period = {
        "start": patPres.generatedOn,
        "end": patPres.generatedOn
    }
    console.log("decoded: ", decoded)
    prescriptionEncounter.participant = [
        {
            "individual": {
                "reference": "Practitioner/" + decoded.userId
            }
        }
    ]
    prescriptionEncounter.uuid = patPres.prescriptionId;
    const encounterBundle =  await bundleStructure.setBundlePut(prescriptionEncounter, null, prescriptionEncounter.id, HTTP_METHODS.PUT, BUNDLE_TYPES.IDENTIFIER)
        
    //  fetch existing medicationRequest
    let existingMedRequest =  await fetchResource("MedicationRequest", {  "encounter": prescriptionEncounter.id, "encounter.type": "prescription-encounter-form", _total: "accurate"}, token);
    console.log("existing medication request:", existingMedRequest)
    existingMedRequest = existingMedRequest.entry ? existingMedRequest.entry.map(e => e.resource) : [];

    // Create sets for quick lookup
        const previousMedIds = new Set(existingMedRequest.map(item => item.medicationReference.reference.split("/")[1]));
        const reqMedIds = new Set(patPres.prescription.map(item => item.medFhirId));
        const previousMedIdsMap = new Map(existingMedRequest.map(item => [item.medicationReference.reference.split("/")[1], item]));
        console.log("previousMedIds:", previousMedIds, "reqMedIds: ", reqMedIds, "previousMedIdsMap: ", previousMedIdsMap, " prescriptionEncounter: ", prescriptionEncounter)
        // Added → in reqMedIds but not in previousMedIds
        patPres.subEncounterId = prescriptionEncounter.id
        const added = patPres.prescription.filter(item => !previousMedIds.has(item.medFhirId));
        const addedMedReq =  await Promise.all(
            added.map((prescription) => {
                prescription.reqUuid = prescription.medReqUuid
                return createMedicationRequestBundle(prescription, patPres, prescriptionEncounter, "post")
            })
        );
        
        // Removed → in previousMedIds but not in reqMedIds
        const removed = existingMedRequest.filter(item => !reqMedIds.has(item.medicationReference.reference.split("/")[1]));
        const idsToDelete = removed.filter(element => element.id)
        .map(resource => resource.id);
        const deletedResources = await deleteMedicationRequestResources(idsToDelete)

        // Common → in both
        const common = patPres.prescription.filter(item => previousMedIds.has(item.medFhirId)).map(item => ({
            ...item,
            medReqFhirId: previousMedIdsMap.get(item.medFhirId).id,
            reqUuid: item.medReqUuid,
            medReqUuid:  previousMedIdsMap.get(item.medFhirId).identifier[0].value
          }));
        const updatedMedReq = await Promise.all(
            common.map((prescription) => createMedicationRequestBundle(prescription, patPres, prescriptionEncounter, "put"))            
        );
        console.log("added: ", added, "  removed: ", removed, "  common: ", common)

    return [encounterBundle, ...deletedResources, ...addedMedReq, ...updatedMedReq]
}


const deleteMedicationRequestResources = async (ids) => {
    const bundlesList = []
    ids.forEach(async (id) => {
        const deletedResource = await bundleStructure.setBundleDelete("MedicationRequest", id);
        bundlesList.push(deletedResource)
    })
   return bundlesList;           
}


const createPrescriptionResources = async (apptData, patPres, tokenDecoded) => {
    const encounterBundle = await createEncounterBundle(patPres, apptData, tokenDecoded);
    const medList = patPres.prescription;
    const encounterData = buildFHIRResource(Encounter, patPres);
    
    // Create medication request bundles in parallel
    const medReqResources = await Promise.all(
        medList.map((prescription) => {
            prescription.reqUuid = prescription.medReqUuid;
            return createMedicationRequestBundle(prescription, patPres, encounterData, "post")
        }
            
        )
    );
    return [encounterBundle, ...medReqResources];
}

/**
 * Fetch appointment encounters based on IDs.
 */
const fetchAppointmentEncounters = async (appointmentEncounterIds, token) => {
    const response = await fetchResource("Encounter", {
        "_id": appointmentEncounterIds.join(","),
        "_count": 5000
    }, token);
    return response.entry.map((e) => e.resource);
};

/**
 * Transform appointment encounter data.
 */
const transformAppointmentEncounter = (encData, appointmentEncounters) => {
    const apptEncounter = appointmentEncounters.find(
        (e) => e.id === encData.resource.partOf.reference.split("/")[1]
    );
    return getTransformedResult(AppointmentEncounter, apptEncounter);
};

/**
 * Extract medication requests for a specific encounter ID.
 */
const extractMedicationRequests = (FHIRData, encounterId) => {
    // console.log("*** ", FHIRData, "^^^^", encounterId)
    return FHIRData.filter(
        (e) =>
            e.resource.resourceType === "MedicationRequest" &&
            e.resource.encounter.reference === `Encounter/${encounterId}`
    ).map((e) => e.resource);
};

/**
 * Build prescription data object.
 */
const buildPrescriptionData = (encData, apptEncounter, medReqList) => {
    console.log(" =>>>" ,encData, apptEncounter, medReqList, "<<=")
    const prescriptionData = {
        prescriptionId: encData.identifier[0].value,
        prescriptionFhirId: encData.id,
        // practitionerId: encData?.participant?.[0]?.individual?.reference?.split("/")?.[1] || null,
        generatedOn: encData.period.start,
        ...apptEncounter,
        prescription: medReqList.map((medReq) => {
            medReq.prescriptionId = encData.identifier[0].value;
            const medData = getTransformedResult(MedicationRequest, medReq);
            medData.qtyPrescribed = medData.qtyPerDose * medData.frequency * medData.duration;
            return medData;
        })
    };
    console.log("Final prescriptions: ", prescriptionData)
    return prescriptionData;
};

/**
 * Get prescription list
 */
const getPrescriptionData = async function (req, res) {
    try {
        const queryParams = {
            "type": "prescription-encounter-form",
            "_total": "accurate",
            "_count": req?.query?._count || 3000,
            "subject": req.query.patientId,
            "_sort": req?.query?._sort || null
        };       
        const token = req.accessToken;
        let resourceUrlData = { link: config.baseUrl + "Encounter", reqQuery: queryParams, allowNesting: 0, specialOffset: 0 }
                
        const responseData = await fetchResource("Encounter", queryParams, token);
        console.log("responseData: ", responseData)
        if (!responseData.entry || responseData.total === 0) {
            return res.status(200).json({ status: 1, message: "Data fetched", total: 0, data: [] });
        }
        const prescriptionFormEncounterIds = [...new Set(responseData.entry.map((e) => e.resource.id))];
        //  Fetch medication requests from prescription encounters
        console.log("prescriptionFormEncounterIds: ", prescriptionFormEncounterIds)
        const medicationRequestResources = await fetchResource("MedicationRequest", {_count:3000, encounter: prescriptionFormEncounterIds.join(",")}, token);
        const prescriptionFormEncounters = responseData.entry;
        //  get appointment encounter ids from prescription encounter
        const appointmentEncounterIds = [...new Set(prescriptionFormEncounters.map((e) => parseInt(e.resource.partOf.reference.split("/")[1])))];
        console.log("appointmentEncounterIds: ", appointmentEncounterIds)
        //  fetch primary encounters from encounter ids
        const appointmentEncounters = await fetchAppointmentEncounters(appointmentEncounterIds, token);
        console.log("medicationRequestResources: ", medicationRequestResources)
        //  map the data together according to main encounter
        const resourceResult = prescriptionFormEncounters.map((encData) => {
            const apptEncounter = transformAppointmentEncounter(encData, appointmentEncounters);
            const medReqList = extractMedicationRequests(medicationRequestResources.entry, encData.resource.id);
            return buildPrescriptionData(encData.resource, apptEncounter, medReqList);
        }).filter((prescriptionData) => prescriptionData.prescription.length > 0);
        // let resStatus = bundleStructure.setResponse(resourceUrlData, responseData);
        res.status(200).json({
            status: 1,
            message: "Data fetched.",
            total: resourceResult.length,
            offset: +queryParams._offset || null,
            data: resourceResult
        });
    } catch (error) {
        console.error("getPrescriptionData Error: ", error);
        return handleError(res, error);
    }
};


const setPrescriptionResponse  = (reqBundleData, responseBundleData, type) => {
    let filteredData = [];
    let response = [];
    const responseData = bundleStructure.mapAssessmentBundleService(reqBundleData, responseBundleData)
    filteredData = responseData.filter(e => e.resource && e.resource.resourceType != "MedicationRequest" && e.resource.resourceType == "Encounter");            
    filteredData = filteredData.map(e => {              
        let medReqData = responseData.filter(medReq =>  medReq.resource && medReq.resource.resourceType == "MedicationRequest" && medReq.resource.identifier[1].value == e.resource.identifier[0].value)
        medReqData = medReqData.map(element => {
            return {
                medReqUuid: element.resource.identifier[0].value, 
                err: element.resource.reqUuid == element.resource.identifier[0].value ? null : "Duplicate record exists.",
                medReqFhirId : element.response.location.substring(element.response.location.indexOf("/") + 1, element.response.location.indexOf("/_history"))
            }
        })
        e.prescription = medReqData
        return e
    });   
    response = responseService.setDefaultAssessmentResponse("MedicationRequest", type, filteredData)
    for(let i=0; i<response.length; i++) {
        response[i].prescription = filteredData[i].prescription || []
    }
    return response;
}


module.exports = {
    savePrescriptionData,
    getPrescriptionData
}