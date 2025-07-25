const {buildFHIRResource, fetchResource, getTransformedResult} = require("../services/helperFunctions");
const Observation = require("../class/VitalCVDObservation");
const bundleStructure = require("../services/bundleOperation");
const { v4: uuidv4 } = require('uuid');

const HTTP_METHODS = {
    POST: "POST",
    GET: "GET"
}

const BUNDLE_TYPES = {
    IDENTIFIER: "identifier"
}

const createObservationBundle = async(resourceData, type, requestType) => {
    try {
        resourceData.module_type = "CVD";
        const resource = buildFHIRResource(Observation, { ...resourceData, optionalParam: type });        
        if(requestType == "post") {
            resource.id = uuidv4();
            return await bundleStructure.setBundlePost(resource, null, resource.id, HTTP_METHODS.POST, BUNDLE_TYPES.IDENTIFIER);
        }            
        else {
            resource.id = resourceData.fhirId;
            return await bundleStructure.setBundlePut(resource, null, resource.id, "PUT", BUNDLE_TYPES.IDENTIFIER);
        }
    }
    catch (error) {
        console.warn(`CVD '${type}' skipped:`, error.message);
        return null; // Return null for skipped CVD types
    }
}

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

const getPractitionerName = (practitionerId, practitionerData) => {
    const practitioner = practitionerData.find((e) => e?.resource?.id === practitionerId);

    if (!practitioner) return "";

    const givenName = practitioner?.resource?.name?.[0]?.given?.join(" ") || "";
    const familyName = practitioner?.resource?.name?.[0]?.family || "";
    return `${givenName} ${familyName}`.trim();
};

const processObservationData = (observationList, observationData, module_type) => {
    return observationList.map((observation) => {
        try {
            // Dynamically transform the observation using the helper function
            observation.module_type = module_type;
            const transformedObservation = getTransformedResult(Observation, observation);
            console.log("transformedObservation: ", transformedObservation)
            return { ...observationData, ...transformedObservation };
        } catch (error) {
            console.warn(`Error processing observation: ${observation.id}`, error.message);
            return observationData; // Return original data if transformation fails
        }
    }).reduce((mergedData, data) => ({ ...mergedData, ...data }), observationData);
};


const deleteEncounter = async (EncounterClass, encounterData) => {
    const deleteList = [];
    for(let enc of encounterData){
        let encounter = new EncounterClass({}, enc).deleteEncounter();
        let encounterDeleteBundle = await bundleStructure.setBundlePut(encounter, encounter.identifier, encounter.id, 'PUT'); 
        deleteList.push(encounterDeleteBundle);
    }
    return deleteList;
}

const createDocumentFiles = async (ResourceClass, labReport, uuidKey) => {
    const documents = [];
    const result = [];

    for (let file of labReport.files) {
        let document = buildFHIRResource(ResourceClass, {
            uuid: file[uuidKey],     // Dynamically access the correct UUID
            filename: file.filename,
            note: file.note
        });

        documents.push(document);
        document = await bundleStructure.setBundlePost(
            document,
            document.identifier,
            document.id,
            "POST",
            "identifier"
        );
        result.push(document);
    }

    return { documents, result };
};

const createEncounterResource = async (ResourceClass, report, typeData,encounterUuid, req) => {
    let encounterData = await fetchResource("Encounter", { "appointment": report.appointmentId, _count: 5000 , "_include": "Encounter:appointment" });    
    let encounter = buildFHIRResource(ResourceClass, { 
        id: encounterUuid,
        uuid: encounterUuid,
        appointmentEncounterId: encounterData.entry[0].resource.id,
        patientId: report.patientId,
        userId: req.decoded.userId,
        generatedOn: report.createdOn,
        orgId: req.decoded.orgId
    });
    encounter.type = [
        {
            "coding": [
                        {
                            "system": "https://your-custom-coding-system",
                            "code": typeData.code,
                            "display": typeData.display
                        }
                    ]
        }
    ];
    let encounterBundle = await bundleStructure.setBundlePost(encounter, encounter.identifier, encounterUuid, "POST", "identifier");
    return encounterBundle;
}

const fetchDocumentData = (DocumentReferenceClass, documents) => {
    let result = [];
    for(let document of documents){
        console.info("DocumentReference get data: ", document.resource)
        let documentData = getTransformedResult(DocumentReferenceClass, document.resource);
        result.push(documentData)
    }
    return result;
}

const getDocumentReport = async (ResourceClass, DocumentReferenceClass, reportList, reportData) => {
    reportData.report = []
    for(let report of reportList){
        let transformedData = getTransformedResult(ResourceClass, report);
        if(transformedData.documentIds.length > 0){
            let documentReferenceResponse = await fetchResource("DocumentReference", { "_id": transformedData.documentIds.join(','), _count: 5000 })
            const documentReferenceData = documentReferenceResponse.entry;
            transformedData.documents = fetchDocumentData(DocumentReferenceClass, documentReferenceData);
            delete transformedData.documentIds;
            reportData.report.push(transformedData);
        }
        else {
            delete transformedData.documentIds;
            transformedData.documents = [];
            reportData.report.push(transformedData);
        }
    }
    return reportData.report;
}

module.exports = {createObservationBundle, createEncounterBundle, getPractitionerName, processObservationData, deleteEncounter, createDocumentFiles, createEncounterResource, getDocumentReport}