const DocumentManifest = require("../class/DocumentManifest");
const DocumentReference = require("../class/BaseDocumentReference");
const Encounter = require("../class/GroupEncounter");
const BaseEncounter = require("../class/BaseEncounter");
let axios = require("axios");
let config = require("../config/nodeConfig");
const bundleStructure = require("../services/bundleOperation")
const responseService = require("../services/responseService");
const { v4: uuidv4 } = require('uuid');
const { fetchResource, buildFHIRResource, handleError, getTransformedResult } = require("../services/helperFunctions");



const createEncounterResource = async (medicalRecord, encounterUuid, req) => {
    let encounterData = await fetchResource("Encounter", { "appointment": medicalRecord.appointmentId, _count: 5000 , "_include": "Encounter:appointment" });   
    
    let encounter = buildFHIRResource(Encounter, { 
        id: encounterUuid,
        uuid: encounterUuid,
        appointmentEncounterId: encounterData.entry[0].resource.id,
        patientId: medicalRecord.patientId,
        userId: req.decoded.userId,
        generatedOn: medicalRecord.createdOn,
        orgId: req.decoded.orgId
    });
    encounter.type = [
        {
            "coding": [
                        {
                            "system": "https://your-custom-coding-system",
                            "code": "medical-report-encounter",
                            "display": "medical Report encounter"
                        }
                    ]
        }
    ];
    console.log("encounterData: ", encounter, encounterData.entry[0].resource.id)
    let encounterBundle = await bundleStructure.setBundlePost(encounter, encounter.identifier, encounterUuid, "POST", "identifier");
    return encounterBundle;
}


const createMedicalReportFiles = async (labReport) => {
    const documents = [];
    const result = [];
    for(let file of labReport.files) {
        let document = buildFHIRResource(DocumentReference, {
            uuid: file.medicalDocumentUuid,
            filename: file.filename, 
            note: file.note
        });
        documents.push(document);
        document = await bundleStructure.setBundlePost(document, document.identifier, document.id, "POST", "identifier");
        result.push(document);
    }
    return {documents, result}
}

//  Save prescription File data
let saveMedicalRecord = async function (req, res) {
    try {
        // let response = resourceValid(req.params);
        // if (response.error) {
        //     console.error(response.error.details)
        //     let errData = { status: 0, response: { data: response.error.details }, message: "Invalid input" }
        //     return res.status(422).json(errData);
        // }
        let resourceResult = [];
        for(let medicalRecord of req.body){ 
            const encounterUuid = uuidv4();
            const encounterBundle = await createEncounterResource(medicalRecord, encounterUuid, req)
            resourceResult.push(encounterBundle);
            //  create labReport
            medicalRecord.encounterId = encounterUuid
            const {documents, result} = await createMedicalReportFiles(medicalRecord)
            medicalRecord.documents = documents;
            resourceResult = [...resourceResult, ...result];
            medicalRecord.practitionerId = req.decoded.userId;
            medicalRecord.practitionerName = req.decoded.userName;
            let report = buildFHIRResource(DocumentManifest, medicalRecord); 
            report = await bundleStructure.setBundlePost(report, null, medicalRecord.medicalReportUuid, "POST", "identifier");
            resourceResult.push(report);
        }
        let bundleData = await bundleStructure.getBundleJSON({resourceResult});
        // return  res.status(201).json({ status: 1, message: "Medical record data saved.", data: bundleData.bundle }) 
        let response = await axios.post(config.baseUrl, bundleData.bundle); 
        console.info("get bundle json response: ", response.status)  
        if (response.status == 200 || response.status == 201) {
            let responseData = setMedicalRecordResponse(bundleData.bundle.entry, response.data.entry, "post"); 
            res.status(201).json({ status: 1, message: "Medical record data saved.", data: responseData })
        }
        else {
            return handleError(res, response);
        }
    }
    catch (error) {
        console.error("saveMedicalRecord Error: " ,error);
        return handleError(res, error);
    }

}

const getDocumentManifest = async (reportList, reportData) => {
    reportData.medicalRecord = []
    for(let medicalRecord of reportList){
        let docManifest = getTransformedResult(DocumentManifest, medicalRecord);
        if(docManifest.documentIds.length > 0){
            let documentReferenceResponse = await fetchResource("DocumentReference", { "_id": docManifest.documentIds.join(','), _count: 5000 })
            const documentReferenceData = documentReferenceResponse.entry;
            console.log("documentReferenceData: ", documentReferenceData)
            docManifest.documents = fetchDocumentData(documentReferenceData);
            delete docManifest.documentIds;
            reportData.medicalRecord.push(docManifest);
        }
        else {
            delete docManifest.documentIds;
            docManifest.documents = [];
            reportData.medicalRecord.push(docManifest);
        }
    }
    return reportData.medicalRecord;
}
//  Get Practitioner data
let getMedicalRecord = async function (req, res) {
    try {
        const queryParams = {
            type :  "medical-report-encounter",
            "service-provider" :  req.decoded.orgId,
            "_count": req.query.count,
            "_offset": req.query.offset
        }
        let resourceResult = []
        let responseData = await fetchResource("Encounter", queryParams);
        let resStatus = 1;
        if( !responseData.entry || responseData.total == 0) {
                return res.status(200).json({ status: resStatus, message: "Data fetched", total: 0, data: []  })
        }
        const encounterList = responseData.entry.map(e=> e.resource);
        console.log("encounterList: ", encounterList)
        const labReportEncounterIds = encounterList.map(e => e.id);
        let mainEncounterIds = new Set(encounterList.map((e) => e.partOf.reference.split('/')[1]));
        mainEncounterIds = [...mainEncounterIds.values()].join(',');

        let mainEncounterList = await fetchResource("Encounter", { _id: mainEncounterIds, _count: 5000});
        mainEncounterList = mainEncounterList?.entry?.map((e) => e?.resource) || [];

        const documentManifestResources = await fetchResource("DocumentManifest", {"related-ref": labReportEncounterIds.join(","), _count:1000})

        for(let encounter of encounterList){
            let mainEncounter = mainEncounterList.find((e) => e.id == encounter.partOf.reference.split('/')[1]);
            const reportData = getTransformedResult(BaseEncounter, mainEncounter);
            delete reportData.prescriptionId;
            let reportList = documentManifestResources.entry.filter(e => e.resource?.related?.[0]?.ref?.reference == "Encounter/"+encounter.id).map(e => e.resource);

            reportData.medicalRecord = await getDocumentManifest(reportList, reportData)            
            delete reportData.labReport;
            if(reportData.medicalRecord.length > 0){
                resourceResult.push(reportData);
            }
        }
        resStatus = bundleStructure.setResponse({ link: config.baseUrl + "Encounter", reqQuery: queryParams, allowNesting: 1, specialOffset: 1 }, responseData);   
        res.status(200).json({ status: resStatus, message: "Data fetched.", total: resourceResult.length,"offset": +queryParams?._offset, data: resourceResult  })
    }
    catch (error) {
        console.error("getMedicalRecord Error: " ,error);
        return handleError(res, error);
    }
}


const deleteEncounter = async (encounterData) => {
    const deleteList = [];
    for(let enc of encounterData){
        let encounter = new Encounter({}, enc).deleteEncounter();
        let encounterDeleteBundle = await bundleStructure.setBundlePut(encounter, encounter.identifier, encounter.id, 'PUT'); 
        deleteList.push(encounterDeleteBundle);
    }
    return deleteList;
}

const deleteDocumentManifestResources = async (documentManifestData, documentReferenceData) => {
    const deleteDocumentManifest = [];
    for(let report of documentManifestData){
        let reportData = new DocumentManifest({}, report).deleteDocumentManifest();
        let docManifestDeleteBundle = await bundleStructure.setBundlePut(reportData, reportData.identifier, reportData.id, 'PUT'); 
        deleteDocumentManifest.push(docManifestDeleteBundle);
        let documents = reportData?.extension || [];
        for(let doc of documents){
            let docId = doc?.reference?.split('/')[1];
            let docResource = documentReferenceData.find((d) => d.id == docId);
            let docData = new DocumentReference({}, docResource).deleteDocument();
            let documentReferenceDeleteBundle = await bundleStructure.setBundlePut(docData, docData.identifier, docData.id, 'PUT'); 
            deleteDocumentManifest.push(documentReferenceDeleteBundle);
        }
    } 
    return deleteDocumentManifest;
}

const deleteMedicalRecord = async (req, res) => {
    try {
        let documentManifestIds = req.body.join(',');
        let documentManifestData = await fetchResource("DocumentManifest", { _id: documentManifestIds, _count: 5000});
        documentManifestData = documentManifestData?.entry?.map((e) => e?.resource) || [];
        let encounterIds = documentManifestData.map((e) => e?.related?.[0]?.ref?.reference.split('/')[1]);
        encounterIds = encounterIds.join(',');
        let encounterData = await fetchResource("Encounter", { _id: encounterIds, _count: 5000});
        encounterData = encounterData?.entry?.map((e) => e?.resource) || [];
        const deleteEncList = await deleteEncounter(encounterData);
        let documentReferenceIds = [];
        documentManifestData.forEach((report) => {
            let documents = report?.content || [];
            documents.forEach((doc) => {
                let docId = doc.reference.split('/')[1];
                documentReferenceIds.push(docId);
            });
        });
        documentReferenceIds = documentReferenceIds.join(',');
        let documentReferenceData = await fetchResource("DocumentReference", { _id: documentReferenceIds, _count: 5000});
        documentReferenceData = documentReferenceData?.entry?.map((e) => e?.resource) || [];
        const deleteDocManifestList = await deleteDocumentManifestResources(documentManifestData, documentReferenceData);
        const resourceResult = [...deleteEncList, ...deleteDocManifestList]
         let bundleData = await bundleStructure.getBundleJSON({resourceResult})  
        let response = await axios.post(config.baseUrl, bundleData.bundle); 
        console.info("get bundle json response: ", response)  
        if (response.status == 200) {
            let responseData = setDeleteMedicalRecordResponse(bundleData.bundle.entry, response.data.entry, "delete");        
            console.info(responseData)
            res.status(201).json({ status: 1, message: "Lab report deleted.", data: responseData })
        }
        else {
            return handleError(res, response);
        }

    }
    catch (error) {
        console.error("deleteMedicalRecord Error: " ,error);
        return handleError(res, error);
    }
}


const fetchDocumentData = (documents) => {
    let result = [];
    for(let document of documents){
        console.info("DocumentReference get data: ", document.resource)
        let documentData = getTransformedResult(DocumentReference, document.resource);
        result.push(documentData)
    }
    return result;
}

const setMedicalRecordResponse  = (reqBundleData, responseBundleData, type) => {
    let filteredData = [];
    let response = [];
    const responseData = bundleStructure.mapBundleService(reqBundleData, responseBundleData)

    filteredData = responseData.filter(e => e.resource.resourceType == "DocumentManifest");
    let documentRefs = responseData.filter(e => e.resource.resourceType == "DocumentReference");
    filteredData = filteredData.map((e) => {
        e.documents = [];
        e?.resource?.content?.forEach((m) => {
            let doc = documentRefs.find((d) => { return d.resource.id == m.reference.split('/')[1].split(':')[2] });
            e.documents.push({
                "medicalDocumentfhirId": doc.response.location.split('/')[1],
                "medicalDocumentUuid": doc.resource.id,
            });
        });
        return e;
    });

    response = responseService.setDefaultResponse("DocumentManifest", type, filteredData)
    for(let i=0; i<response.length; i++) {
        response[i].files = filteredData[i].documents || []
    }
    return response;
}

const setDeleteMedicalRecordResponse = (reqBundleData, responseBundleData) => {
    let filteredData = [];
    let response = [];
    const responseData = bundleStructure.mapBundleService(reqBundleData, responseBundleData)

    filteredData = responseData.filter(e => e.request.url.split('/')[0] == "DocumentManifest");
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
    saveMedicalRecord,
    getMedicalRecord,
    deleteMedicalRecord
}