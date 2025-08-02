
const MedicationRequest = require("../class/MedicationRequest");
const DocumentReference = require("../class/BaseDocumentReference")
const Encounter = require("../class/PrescriptionDocEncounter")
const { v4: uuidv4 } = require('uuid');
let axios = require("axios");
let config = require("../config/nodeConfig");
const bundleStructure = require("../services/bundleOperation")
const responseService = require("../services/responseService");
const { fetchResource, buildFHIRResource, handleError, getTransformedResult } = require("../services/helperFunctions");
const { prescriptionFileArraySchema } = require("../utils/Validator/prescriptionValidator");
const {validateRequest} = require("../utils/validateRequest");

const createEncounterResource = async (patPres, token) => {
    try {
        const encounterData = await fetchResource("Encounter", { "appointment": patPres.appointmentId, _count: 5000 , "_include": "Encounter:appointment" });
        const encounter = buildFHIRResource(Encounter, { 
            id: patPres.prescriptionId,
            encounterId: encounterData.entry[0].resource.id,
            patientId: patPres.patientId,
            prescriptionId: patPres.prescriptionId,
            practitionerId: token.userId,
            generatedOn: patPres.generatedOn,
            orgId: token.orgId
        }, token);  
        return encounter;
    }
    catch(error) {
        console.error("createEncounterResource Error: ", error)
    }
}

/**
 * Generate group identifier based on date and patient ID.
 */
const generateGroupIdentifier = (generatedOn, patientId) => {
    const dateToday = new Date(generatedOn).getTime().toString();
    const lastDigits = dateToday.slice(9, -1);
    return lastDigits + patientId;
};

/**
 * Build prescription object.
 */
const buildPrescriptionObject = (patPres, grpIdentify) => {
    return {
        identifier: [
            {
                system: config.medReqUuidUrl,
                value: uuidv4()
            }
        ],
        grpIdentify: grpIdentify,
        patientId: patPres.patientId,
        encounterId: patPres.prescriptionId,
        prescriptionFiles: patPres.prescriptionFiles
    };
};

const createDocumentReference = async (patPres) => {
    const resourceResult =[];
    for(let document of patPres.prescriptionFiles) {
        let documentRefData = buildFHIRResource(DocumentReference, {
            filename: document.filename, 
            note: document.note, 
            uuid: document.documentUuid
        });
        let documentResource = await bundleStructure.setBundlePost(documentRefData, documentRefData.identifier, documentRefData.id, "POST", "identifier");
        resourceResult.push(documentResource); 
    }
    return resourceResult;
}
//  Save prescription File data
const savePrescriptionFile = async function (req, res) {
    try {
        const validatedBody = validateRequest(req.body, prescriptionFileArraySchema, res);
        if (!validatedBody) return;
        const token = req.accessToken;
        const resourceResult = await Promise.all(
            req.body.map(async (patPres) => {
                try {
                    // Create encounter resource
                    const encounter = await createEncounterResource(patPres, req.decoded);
                    // Generate group identifier
                    const grpIdentify = generateGroupIdentifier(patPres.generatedOn, patPres.patientId);
                    // Build prescription object
                    const prescription = buildPrescriptionObject(patPres, grpIdentify);
                    // Create bundles
                    const encounterBundle = await bundleStructure.setBundlePost(encounter, null, patPres.prescriptionId,"POST","identifier");
                    const medicationResourceBundle = await bundleStructure.setBundlePost(
                        buildFHIRResource(MedicationRequest, prescription),  prescription.identifier,  prescription.identifier[0].value,"POST", "identifier");

                    // Create document reference
                    const medicalDoc = await createDocumentReference(patPres);

                    return [encounterBundle, medicationResourceBundle, ...medicalDoc];
                } catch (error) {
                    console.warn(`Error processing prescription: ${patPres.prescriptionId}`, error.message);
                    return []; // Return empty array for skipped prescriptions
                }
            })
        );
        // Flatten the resource results
        const flattenedResourceResult = resourceResult.flat();
        // Create bundle and send request
        const bundleData = await bundleStructure.getBundleJSON({ resourceResult: flattenedResourceResult });
        // return res.status(201).json({ status: 1, message: "Practitioner data saved.", data: bundleData.bundle });
        const response = await axios.post(config.baseUrl, bundleData.bundle, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/fhir+json'
            }
        });
        console.info("get bundle json response: ", response.status);
        if (response.status === 200 || response.status === 201) {
            const responseData = setPrescriptionFileResponse(bundleData.bundle.entry, response.data.entry, "post");
            return res.status(201).json({ status: 1, message: "Practitioner data saved.", data: responseData });
        } else {
            return handleError(res, response);
        }
    } catch (error) {
        console.error("savePrescriptionFile Error: ", error);
        return handleError(res, error);
    }
};


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
        (e) => e.id === encData.partOf.reference.split("/")[1]
    );
    return getTransformedResult(Encounter, apptEncounter);
};

/**
 * Extract medication requests for a specific encounter ID.
 */
const extractMedicationRequests = (FHIRData, encounterId) => {
    return FHIRData.filter(
        (e) =>
            e.resource.resourceType === "MedicationRequest" &&
            e.resource.encounter.reference === `Encounter/${encounterId}`
    ).map((e) => e.resource);
};

/**
 * Fetch document references for medication requests.
 */
const fetchDocumentReferences = async (medReqList, token) => {
    const documents = medReqList[0]?.supportingInformation || [];
    const documentIds = documents.map((document) => document.reference.split("/")[1]);

    const documentRefsResponse = await fetchResource("DocumentReference", {
        "_id": documentIds.join(","),
        "_count": 5000
    }, token);

    return documentRefsResponse?.entry?.map((e) => e.resource) || [];
};

/**
 * Build prescription file data object.
 */
const buildPrescriptionFileData = (encData, apptEncounter, medReqList, documentRefs) => {
    console.log("encdata: ", encData)
    apptEncounter.prescriptionFiles = [];
    apptEncounter.prescriptionDocumentFhirId = encData.id;
    apptEncounter.status = medReqList?.[0]?.status === "entered-in-error" ? "deleted" : "saved";
    apptEncounter.prescriptionId = encData?.identifier?.[0]?.value || null;
    apptEncounter.generatedOn = encData?.period?.start || null;
    apptEncounter.practitionerId = encData.participant[0].individual.reference.split("/")[1]
    apptEncounter.prescriptionFiles = documentRefs.map((document) =>
        getTransformedResult(DocumentReference, document)
    );

    return apptEncounter;
};

//  Get Practitioner data
let getPrescriptionFile = async function (req, res) {
    try {
        const queryParams = {
            "_revinclude": "MedicationRequest:encounter:Encounter",
            "service-provider": req.decoded.orgId,
            "type": "prescription-encounter-document",
            "_total": "accurate",
            "_count": 3000,
            "patient": req.query.patientId
        }
        const token = req.accessToken;
        const responseData = await fetchResource("Encounter", queryParams, token);
        if (!responseData.entry || responseData.total === 0) {
            return res.status(200).json({ status: 1, message: "Data fetched", total: 0, data: [] });
        }

        const FHIRData = responseData.entry;
        const prescriptionDocumentEncounter = FHIRData.filter(e => e.resource.resourceType == "Encounter").map(e => e.resource);
        let appointmentEncounterIds = [... new Set(prescriptionDocumentEncounter.map(e =>  parseInt(e.partOf.reference.split("/")[1])))];
        const appointmentEncounters = await fetchAppointmentEncounters(appointmentEncounterIds, token);

        const resourceResult = await Promise.all(
            prescriptionDocumentEncounter.map(async (encData) => {
                const apptEncounter = transformAppointmentEncounter(encData, appointmentEncounters);
                const medReqList = extractMedicationRequests(FHIRData, encData.id);
                const documentRefs = await fetchDocumentReferences(medReqList, token);
                return buildPrescriptionFileData(encData, apptEncounter, medReqList, documentRefs);           
            })
        );
        res.status(200).json({ status: 1, message: "Data fetched.", total: resourceResult.length,"offset": +queryParams?._offset || null, data: resourceResult  })
        
    }
    catch (error) {
            console.error("getPrescriptionFile Error: ", error);
            return handleError(res, error);
        }
}

const processEncounters = async (encounterIds, token) => {
    const resourceResult = [];
    const encounterData = await fetchResource("Encounter", { _id: encounterIds, _count: 5000 }, token);
    const encounters = encounterData?.entry?.map((e) => e?.resource) || [];

    await Promise.all(
        encounters.map(async (encounter) => {
            const enc = new Encounter({}, encounter).deletePrescriptionDocument();
            const encounterDeleteBundle = await bundleStructure.setBundlePut(enc, enc.identifier, enc.id, 'PUT');
            resourceResult.push(encounterDeleteBundle);
        })
    );

    return resourceResult;
};

const fetchMedicationRequests = async (encounterIds, token) => {
    const medicationRequestData = await fetchResource("MedicationRequest", { encounter: encounterIds, _count: 5000 }, token);
    return medicationRequestData?.entry?.map((e) => e?.resource) || [];
};


/**
 * Extract document reference IDs from medication requests.
 */
const extractDocumentReferenceIds = (medicationRequests) => {
    const documentReferenceIds = [];
    medicationRequests.forEach((medicationRequest) => {
        const supportingInformation = medicationRequest?.supportingInformation || [];
        supportingInformation.forEach((doc) => {
            const docId = doc?.reference?.split('/')[1];
            if (docId) {
                documentReferenceIds.push(docId);
            }
        });
    });
    return documentReferenceIds;
};

const fetchDocumentReferenceList = async (documentReferenceIds, token) => {
    const documentReferenceData = await fetchResource("DocumentReference", { _id: documentReferenceIds.join(','), _count: 5000 }, token);
    return documentReferenceData?.entry?.map((e) => e?.resource) || [];
};

const processMedicationRequestsAndDocuments = async (medicationRequests, documentReferences, resourceResult) => {
    await Promise.all(
        medicationRequests.map(async (medicationRequest) => {
            const medData = new MedicationRequest({}, medicationRequest).deletePrescriptionDocument();
            const medRequestDeleteBundle = await bundleStructure.setBundlePut(medData, medData.identifier, medData.id, 'PUT');
            resourceResult.push(medRequestDeleteBundle);

            const documents = medicationRequest?.supportingInformation || [];
            await Promise.all(
                documents.map(async (doc) => {
                    const docId = doc?.reference.split('/')[1];
                    const docResource = documentReferences.find((d) => d.id === docId);
                    if (docResource) {
                        const docData = new DocumentReference({}, docResource).deleteDocument();
                        const documentReferenceDeleteBundle = await bundleStructure.setBundlePut(docData, docData.identifier, docData.id, 'PUT');
                        resourceResult.push(documentReferenceDeleteBundle);
                    }
                })
            );
        })
    );
};

const deletePrescriptionFile = async (req, res) => {
    try {
        // Validate input
        if (!Array.isArray(req.body) || req.body.length === 0) {
            return res.status(400).json({ status: 0, message: "Invalid input data." });
        }

        const encounterIds = req.body.join(',');
        const token = req.accessToken;
        // Fetch and process encounters
        const resourceResult = await processEncounters(encounterIds, token);
        
        // Fetch and process medication requests
        const medicationRequests = await fetchMedicationRequests(encounterIds, token);
        const documentReferenceIds = extractDocumentReferenceIds(medicationRequests);

        // Fetch and process document references
        const documentReferences = await fetchDocumentReferenceList(documentReferenceIds, token);
        await processMedicationRequestsAndDocuments(medicationRequests, documentReferences, resourceResult);

        // Create bundle and send request
        const bundleData = await bundleStructure.getBundleJSON({ resourceResult });
        const response = await axios.post(config.baseUrl, bundleData.bundle, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/fhir+json'
            }
        });

        if (response.status === 200) {
            const responseData = setDeleteFileResponse(bundleData.bundle.entry, response.data.entry, "delete");
            return res.status(201).json({ status: 1, message: "Data deleted.", data: responseData });
        } else {
            return handleError(res, response);
        }
    } catch (error) {
        console.error("DeletePrescriptionFile Error: ", error);
        return handleError(res, error);
    }
};



const setPrescriptionFileResponse  = (reqBundleData, responseBundleData, type) => {
    let filteredData = [];
    let response = [];
    const responseData = bundleStructure.mapBundleService(reqBundleData, responseBundleData)

    filteredData = responseData.filter(e => e.resource.resourceType == "Encounter" && e.resource.type[0].coding[0].code == "prescription-encounter-document");
    let medicationRequest = responseData.filter(e => e.resource.resourceType == "MedicationRequest");
    let documentRefs = responseData.filter(e => e.resource.resourceType == "DocumentReference");
    console.log("-->>", filteredData, medicationRequest, documentRefs, "<<--")
    filteredData = filteredData.map((e) => {
        e.documents = [];
        let med = medicationRequest.find((m) => {return m.resource.encounter.reference.split(':')[2] == e.fullUrl.split(':')[2]});
        console.log("check med: ", med)
        med.resource.supportingInformation.forEach((m) => {
            let doc = documentRefs.find((d) => { return d.fullUrl.split(':')[2] == m.reference.split(':')[2] });
            e.documents.push({
                documentfhirId: doc.response.location.split('/')[1],
                documentUuid: doc.resource.id,
            });
        });
        return e;
    });

    response = responseService.setDefaultResponse("PrescriptionFile", type, filteredData)
    for(let i=0; i<response.length; i++) {
        response[i].prescriptionFiles = filteredData[i].documents || []
    }
    return response;
}

const setDeleteFileResponse = (reqBundleData, responseBundleData) => {
    let filteredData = [];
    let response = [];
    const responseData = bundleStructure.mapBundleService(reqBundleData, responseBundleData)

    filteredData = responseData.filter(e => e.request.url.split('/')[0] == "Encounter");
    console.info("filteredArray", JSON.stringify(filteredData));
    filteredData.forEach((element) => {
        response.push({
            status: element.response.status,
            id: null,
            err: null,
            fhirId: element.response.location.split('/')[1]
        });
    });
    return response;
}


module.exports = {
    savePrescriptionFile,
    getPrescriptionFile,
    deletePrescriptionFile
}