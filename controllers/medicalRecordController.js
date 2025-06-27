const DocumentManifest = require("../class/DocumentManifest");
const DocumentReference = require("../class/BaseDocumentReference");
const Encounter = require("../class/BaseEncounter");
let axios = require("axios");
let config = require("../config/nodeConfig");
const bundleStructure = require("../services/bundleOperation")
const responseService = require("../services/responseService");
const { v4: uuidv4 } = require('uuid');

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
            let encounterData = await bundleStructure.searchData(config.baseUrl + "Encounter", { "appointment": medicalRecord.appointmentId, _count: 5000 , "_include": "Encounter:appointment" });

            let encounterUuid = uuidv4();
            let encounter = new Encounter({ 
                id: encounterUuid,
                encounterId: encounterData.data.entry[0].resource.id,
                patientId: medicalRecord.patientId,
                practitionerId: req.decoded.userId,
                createdOn: medicalRecord.createdOn,
                orgId: req.decoded.orgId
            }, {}).getUserInputToFhirForMedicalReport();
            let encounterBundle = await bundleStructure.setBundlePost(encounter, encounter.identifier, encounter.id, "POST", "identifier");
            resourceResult.push(encounterBundle);
            medicalRecord.encounterId = encounter.id;

            let documents = [];
            for(let file of medicalRecord.files) {
                let document = new DocumentReference({
                    uuid: file.medicalDocumentUuid,
                    filename: file.filename, 
                    note: file.note
                }, {}).getJSONtoFhir();
                documents.push(document);
                document = await bundleStructure.setBundlePost(document, document.identifier, document.id, "POST", "identifier");
                resourceResult.push(document);
            }
            medicalRecord.documents = documents;
            medicalRecord.practitionerId = req.decoded.userId;
            medicalRecord.practitionerName = req.decoded.userName;
            let report = new DocumentManifest(medicalRecord, {}).getUserInputToFhir(); 
            report = await bundleStructure.setBundlePost(report, null, medicalRecord.medicalReportUuid, "POST", "identifier");
            resourceResult.push(report);
        }
        let bundleData = await bundleStructure.getBundleJSON({resourceResult})  
        let response = await axios.post(config.baseUrl, bundleData.bundle); 
        console.info("get bundle json response: ", response.status)  
        if (response.status == 200 || response.status == 201) {
            let responseData = setMedicalRecordResponse(bundleData.bundle.entry, response.data.entry, "post");        

            res.status(201).json({ status: 1, message: "Lab report data saved.", data: responseData })
        }
        else {
                return res.status(500).json({
                status: 0, message: "Unable to process. Please try again.", error: response
            })
        }
    }
    catch (e) {
        console.error(e);
        return res.status(500).json({
            status: 0,
            message: "Unable to process. Please try again.",
            error: e
        })
    }

}

//  Get Practitioner data
let getMedicalRecord = async function (req, res) {
    try {
        const link = config.baseUrl + "Encounter";
        let queryParams = {
            _revinclude : "DocumentManifest:related-ref:Encounter",
            type :  "medical-report-encounter",
            "service-provider" :  req.decoded.orgId,
            "_count": req.query.count,
            "_offset": req.query.offset
        }
        let resourceResult = []
        let responseData = await bundleStructure.searchData(link, queryParams);
        let resStatus = 1;
        console.info("FHIRData: ", responseData)
        if( !responseData.data.entry || responseData.data.total == 0) {
                return res.status(200).json({ status: resStatus, message: "Data fetched", total: 0, data: []  })
        }
        const FHIRData = responseData.data.entry;
        let encounterList = FHIRData.filter(e => e.resource.resourceType == "Encounter").map(e => e.resource);
        let mainEncounterIds = new Set(encounterList.map((e) => e.partOf.reference.split('/')[1]));
        mainEncounterIds = [...mainEncounterIds.values()].join(',');
        let mainEncounterList = await bundleStructure.searchData(config.baseUrl + "Encounter", { _id: mainEncounterIds, _count: 5000});
        mainEncounterList = mainEncounterList?.data?.entry?.map((e) => e?.resource) || [];
        for(let encounter of encounterList){
            let mainEncounter = mainEncounterList.find((e) => e.id == encounter.partOf.reference.split('/')[1]);
            let report = new Encounter({}, mainEncounter);
            report.getFhirToJson();
            let reportData = report.getEncounterResource();
            delete reportData.prescriptionId;
        
            let reportList = FHIRData.filter(e => e.resource.resourceType == "DocumentManifest" && e.resource?.related?.[0]?.ref?.reference == "Encounter/"+encounter.id).map(e => e.resource);
            reportData.medicalRecord = [];
            for(let medicalRecord of reportList){
                let data = new DocumentManifest(reportData ,medicalRecord).getFHIRToUserData();
                console.log("documentIds", data.documentIds);
                if(data.documentIds.length > 0){
                    let documentReferenceResponse = await bundleStructure.searchData(config.baseUrl + "DocumentReference", { "_id": data.documentIds.join(','), _count: 5000 });
                    let documentReferenceData = documentReferenceResponse.data.entry;
                    data.documents = fetchDocumentData(documentReferenceData);
                    delete data.documentIds;
                    reportData.medicalRecord.push(data);
                }
                else {
                    delete data.documentIds;
                    data.documents = [];
                    reportData.medicalRecord.push(data);
                }
            }
            delete reportData.labReport;
            if(reportData.medicalRecord.length > 0){
                resourceResult.push(reportData);
            }
        }
        res.status(200).json({ status: resStatus, message: "Data fetched.", total: resourceResult.length,"offset": +queryParams?._offset, data: resourceResult  })
    }
    catch(e) {
        console.error("Error",e)
        return res.status(200).json({
                status: 0,
                message: "Unable to process. Please try again"
            })
       
    }
}

const deleteMedicalRecord = async (req, res) => {
    try {
        let resourceResult = [];
        let documentManifestIds = req.body.join(',');
        let documentManifestData = await bundleStructure.searchData(config.baseUrl + "DocumentManifest", { _id: documentManifestIds, _count: 5000});
        documentManifestData = documentManifestData?.data?.entry?.map((e) => e?.resource) || [];
        let encounterIds = documentManifestData.map((e) => e?.related?.[0]?.ref?.reference.split('/')[1]);
        encounterIds = encounterIds.join(',');
        let encounterData = await bundleStructure.searchData(config.baseUrl + "Encounter", { _id: encounterIds, _count: 5000});
        encounterData = encounterData?.data?.entry?.map((e) => e?.resource) || [];
        for(let enc of encounterData){
            let encounter = new Encounter({}, enc).deleteEncounter();
            let encounterDeleteBundle = await bundleStructure.setBundlePut(encounter, encounter.identifier, encounter.id, 'PUT'); 
            resourceResult.push(encounterDeleteBundle);
        }
        let documentReferenceIds = [];
        documentManifestData.forEach((report) => {
            let documents = report?.content || [];
            documents.forEach((doc) => {
                let docId = doc.reference.split('/')[1];
                documentReferenceIds.push(docId);
            });
        });
        documentReferenceIds = documentReferenceIds.join(',');
        let documentReferenceData = await bundleStructure.searchData(config.baseUrl + "DocumentReference", { _id: documentReferenceIds, _count: 5000});
        documentReferenceData = documentReferenceData?.data?.entry?.map((e) => e?.resource) || [];
        
        for(let report of documentManifestData){
            let reportData = new DocumentManifest({}, report).deleteDocumentManifest();
            let reportDeleteBundle = await bundleStructure.setBundlePut(reportData, reportData.identifier, reportData.id, 'PUT'); 
            resourceResult.push(reportDeleteBundle);
            let documents = reportData?.content || [];
            for(let doc of documents){
                let docId = doc?.reference?.split('/')[1];
                let docResource = documentReferenceData.find((d) => d.id == docId);
                let docData = new DocumentReference({}, docResource).deleteDocument();
                let documentReferenceDeleteBundle = await bundleStructure.setBundlePut(docData, docData.identifier, docData.id, 'PUT'); 
                resourceResult.push(documentReferenceDeleteBundle);
            }
        }  
        
        let bundleData = await bundleStructure.getBundleJSON({resourceResult})  
        let response = await axios.post(config.baseUrl, bundleData.bundle); 
        console.info("get bundle json response: ", response)  
        if (response.status == 200) {
            let responseData = setDeleteMedicalRecordResponse(bundleData.bundle.entry, response.data.entry, "delete");        
            console.info(responseData)
            res.status(201).json({ status: 1, message: "Lab report deleted.", data: responseData })
        }
        else {
                return res.status(500).json({
                status: 0, message: "Unable to process. Please try again.", error: response
            })
        }

    }
    catch(e) {
        console.error("Error",e)
        return res.status(200).json({
                status: 0,
                message: "Unable to process. Please try again"
            })
    }
}


const fetchDocumentData = (documents) => {
    let result = [];
    for(let document of documents){
        console.info(document.resource)
        let documentData = new DocumentReference({}, document.resource).getFHIRToJSONForMedicalRecord();
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