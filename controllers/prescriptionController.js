
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


const HTTP_METHODS = {
    POST: "POST"
};

const BUNDLE_TYPES = {
    IDENTIFIER: "identifier"
};


const createEncounterBundle = async (patPres, apptData, token) => {
    patPres.uuid = patPres.prescriptionId;
    patPres.code = "prescription-encounter-form";
    patPres.display = "Prescription management";
    patPres.appointmentEncounterId = apptData.id;
    patPres.practitionerId = token.userId;
    patPres.orgId = token.orgId;
    const encounterData = buildFHIRResource(Encounter, patPres);
    return await bundleStructure.setBundlePost(
        encounterData,
        encounterData.identifier,
        patPres.uuid,
        HTTP_METHODS.POST,
        BUNDLE_TYPES.IDENTIFIER
    );
};

const createMedicationRequestBundle = async (prescription, patPres, encounterData) => {
    const dateToday = new Date(patPres.generatedOn).getTime().toString();
    const lastDigits = dateToday.slice(9, -1);
    const grpIdentify = lastDigits + patPres.patientId;

    prescription.patientId = patPres.patientId;
    prescription.generatedOn = patPres.generatedOn;
    prescription.prescriptionId = patPres.prescriptionId;
    prescription.encounterId = patPres.uuid;
    prescription.grpIdentify = grpIdentify;
    prescription.identifier = [
        {
            system: config.medReqUuidUrl,
            value: prescription.medReqUuid
        },
        ...encounterData.identifier
    ];

    const medReqData = buildFHIRResource(MedicationRequest, prescription);

    return await bundleStructure.setBundlePost(
        medReqData,
        prescription.identifier,
        prescription.medReqUuid,
        HTTP_METHODS.POST,
        BUNDLE_TYPES.IDENTIFIER
    );
};

//  Save prescription data
let savePrescriptionData = async function (req, res) {
    try {
        const validatedBody = validateRequest(req.body, prescriptionArraySchema, res);
        if (!validatedBody) return;
        const resourceResult = await Promise.all(
            req.body.map(async (patPres) => {
                try {
                    // Fetch appointment encounter
                    const appointmentEncounter = await fetchResource("Encounter", {
                        appointment: patPres.appointmentId,
                        _count: 5000,
                        _include: "Encounter:appointment"
                    });
                    const apptData = appointmentEncounter.entry[0].resource;
                    // Create encounter bundle
                    const encounterBundle = await createEncounterBundle(patPres, apptData, req.decoded);
                    const medList = patPres.prescription;
                    const encounterData = buildFHIRResource(Encounter, patPres);

                    // Create medication request bundles in parallel
                    const medReqResources = await Promise.all(
                        medList.map((prescription) =>
                            createMedicationRequestBundle(prescription, patPres, encounterData)
                        )
                    );
                    return [encounterBundle, ...medReqResources];
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
        // return res.status(201).json({ status: 1, message: "Practitioner data saved.", data: bundleData.bundle });
        const response = await axios.post(config.baseUrl, bundleData.bundle);
        console.info("get bundle json response: ", response.status);

        if (response.status === 200 || response.status === 201) {
            const responseData = setPrescriptionResponse(bundleData.bundle.entry, response.data.entry, "post");
            return res.status(201).json({ status: 1, message: "Practitioner data saved.", data: responseData });
        } else {
            return handleError(res, response);
        }
    } catch (error) {
        console.error("savePrescriptionData Error: ", error);
        return handleError(res, error);
    }
};


/**
 * Fetch appointment encounters based on IDs.
 */
const fetchAppointmentEncounters = async (appointmentEncounterIds) => {
    const response = await fetchResource("Encounter", {
        "_id": appointmentEncounterIds.join(","),
        "_count": 5000
    });
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
        practitionerId: encData?.participant?.[0]?.individual?.reference?.split("/")?.[1] || null,
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
        // Validate input
        // if (!req.query.patientId) {
        //     return res.status(400).json({ status: 0, message: "Missing patient ID." });
        // }
        //  Get prescripiton encounters
        const queryParams = {
            // "_revinclude": "MedicationRequest:encounter:Encounter",
            "type": "prescription-encounter-form",
            "_total": "accurate",
            "_count": 3000,
            "subject": req.query.patientId
        };       

        const responseData = await fetchResource("Encounter", queryParams);
        console.log("responseData: ", responseData)
        if (!responseData.entry || responseData.total === 0) {
            return res.status(200).json({ status: 1, message: "Data fetched", total: 0, data: [] });
        }
        const prescriptionFormEncounterIds = [...new Set(responseData.entry.map((e) => e.resource.id))];
        //  Fetch medication requests from prescription encounters
        console.log("prescriptionFormEncounterIds: ", prescriptionFormEncounterIds)
        const medicationRequestResources = await fetchResource("MedicationRequest", {_count:3000, encounter: prescriptionFormEncounterIds.join(",")});
        const prescriptionFormEncounters = responseData.entry;
        //  get appointment encounter ids from prescription encounter
        const appointmentEncounterIds = [...new Set(prescriptionFormEncounters.map((e) => parseInt(e.resource.partOf.reference.split("/")[1])))];
        console.log("appointmentEncounterIds: ", appointmentEncounterIds)
        //  fetch primary encounters from encounter ids
        const appointmentEncounters = await fetchAppointmentEncounters(appointmentEncounterIds);
        console.log("medicationRequestResources: ", medicationRequestResources)
        //  map the data together according to main encounter
        const resourceResult = prescriptionFormEncounters.map((encData) => {
            const apptEncounter = transformAppointmentEncounter(encData, appointmentEncounters);
            const medReqList = extractMedicationRequests(medicationRequestResources.entry, encData.resource.id);
            return buildPrescriptionData(encData.resource, apptEncounter, medReqList);
        }).filter((prescriptionData) => prescriptionData.prescription.length > 0);

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
    const responseData = bundleStructure.mapBundleService(reqBundleData, responseBundleData)
    filteredData = responseData.filter(e => e.resource.resourceType != "MedicationRequest" && e.resource.resourceType == "Encounter");            
    filteredData = filteredData.map(e => {              
        let medReqData = responseData.filter(medReq => medReq.resource.resourceType == "MedicationRequest" && medReq.resource.identifier[1].value == e.resource.identifier[0].value)
        medReqData = medReqData.map(element => {
            return {
                medReqUuid :element.resource.identifier[0].value, 
                medReqFhirId : element.response.location.substring(element.response.location.indexOf("/") + 1, element.response.location.indexOf("/_history"))
            }
        })
        e.prescription = medReqData
        return e
    });   
    response = responseService.setDefaultResponse("MedicationRequest", type, filteredData)
    for(let i=0; i<response.length; i++) {
        response[i].prescription = filteredData[i].prescription || []
    }
    return response;
}


module.exports = {
    savePrescriptionData,
    getPrescriptionData
}