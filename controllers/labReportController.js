const DiagnosticReport = require("../class/DiagnosticReport");
const DocumentReference = require("../class/BaseDocumentReference");
const Encounter = require("../class/GroupEncounter");
const BaseEncounter = require("../class/BaseEncounter");
let axios = require("axios");
let config = require("../config/nodeConfig");
const bundleStructure = require("../services/bundleOperation")
const responseService = require("../services/responseService");
const { v4: uuidv4 } = require('uuid');
const { fetchResource, buildFHIRResource, handleError, getTransformedResult } = require("../services/helperFunctions");
const GroupEncounter = require("../class/GroupEncounter");


const createEncounterResource = async (labReport, encounterUuid, req) => {
    let encounterData = await fetchResource("Encounter", { "appointment": labReport.appointmentId, _count: 5000 , "_include": "Encounter:appointment" });
    

    let encounter = buildFHIRResource(Encounter, { 
        id: encounterUuid,
        uuid: encounterUuid,
        encounterId: encounterData.entry[0].resource.id,
        patientId: labReport.patientId,
        userId: req.decoded.userId,
        generatedOn: labReport.createdOn,
        orgId: req.decoded.orgId
    });
    encounter.type = [
        {
            "coding": [
                        {
                            "system": "https://your-custom-coding-system",
                            "code": "lab-report-encounter",
                            "display": "Lab Report encounter"
                        }
                    ]
        }
    ];
    let encounterBundle = await bundleStructure.setBundlePost(encounter, encounter.identifier, encounterUuid, "POST", "identifier");
    return encounterBundle;
}


const createLabReportFiles = async (labReport) => {
    const documents = [];
    const result = [];
    for(let file of labReport.files) {
        let document = buildFHIRResource(DocumentReference, {
            uuid: file.labDocumentUuid,
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
let saveLabReport = async function (req, res) {
    try {
        // let response = resourceValid(req.params);
        // if (response.error) {
        //     console.error(response.error.details)
        //     let errData = { status: 0, response: { data: response.error.details }, message: "Invalid input" }
        //     return res.status(422).json(errData);
        // }
        let resourceResult = [];
        for(let labReport of req.body){ 
            const encounterUuid = uuidv4();
            const encounterBundle = await createEncounterResource(labReport, encounterUuid, req)
            resourceResult.push(encounterBundle);
            //  create labReport
            labReport.encounterId = encounterUuid

            const {documents, result} = await createLabReportFiles(labReport)
            labReport.documents = documents;
            resourceResult = [...resourceResult, ...result];
            let report = buildFHIRResource(DiagnosticReport, labReport); 
            report = await bundleStructure.setBundlePost(report, null, labReport.diagnosticUuid, "POST", "identifier");
            resourceResult.push(report);
        }
        let bundleData = await bundleStructure.getBundleJSON({resourceResult}) 
        // return res.status(200).json({data: bundleData.bundle}) 
        let response = await axios.post(config.baseUrl, bundleData.bundle); 
        console.info("get bundle json response: ", response.status)  
        if (response.status == 200 || response.status == 201) {
            let responseData = setLabReportResponse(bundleData.bundle.entry, response.data.entry, "post");        

            res.status(201).json({ status: 1, message: "Lab report data saved.", data: responseData })
        }
        else {
            return handleError(res, response);
        }
    }
    catch (error) {
        console.error("saveLabReport Error: " ,error);
        return handleError(res, error);
    }

}

const getDiagnosticReport = async (reportList, reportData) => {
    reportData.diagnosticReport = []
    for(let diagnosticReport of reportList){
        let diagReport = getTransformedResult(DiagnosticReport, diagnosticReport);
        if(diagReport.documentIds.length > 0){
            let documentReferenceResponse = await bundleStructure.searchData(config.baseUrl + "DocumentReference", { "_id": diagReport.documentIds.join(','), _count: 5000 });
            let documentReferenceData = documentReferenceResponse.data.entry;
            diagReport.documents = fetchDocumentData(documentReferenceData);
            delete diagReport.documentIds;
            reportData.diagnosticReport.push(diagReport);
        }
        else {
            delete diagReport.documentIds;
            diagReport.documents = [];
            reportData.diagnosticReport.push(diagReport);
        }
    }
    return reportData.diagnosticReport;
}

//  Get Practitioner data
let getLabReport = async function (req, res) {
    try {
        const queryParams = {
            type :  "lab-report-encounter",
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
        const labReportEncounterIds = encounterList.map(e => e.id);
        let mainEncounterIds = new Set(encounterList.map((e) => e.partOf.reference.split('/')[1]));
        mainEncounterIds = [...mainEncounterIds.values()].join(',');

        let mainEncounterList = await fetchResource("Encounter", { _id: mainEncounterIds, _count: 5000});
        mainEncounterList = mainEncounterList?.entry?.map((e) => e?.resource) || [];

        const diagnosticReportResources = await fetchResource("DiagnosticReport", {encounter: labReportEncounterIds.join(","), _count:1000})

        for(let encounter of encounterList){
            let mainEncounter = mainEncounterList.find((e) => e.id == encounter.partOf.reference.split('/')[1]);
            const reportData = getTransformedResult(BaseEncounter, mainEncounter);
            delete reportData.prescriptionId;
        
            let reportList = diagnosticReportResources.entry.filter(e => e.resource.encounter.reference == "Encounter/"+encounter.id).map(e => e.resource);

            reportData.diagnosticReport = await getDiagnosticReport(reportList, reportData)            
            delete reportData.labReport;
            if(reportData.diagnosticReport.length > 0){
                resourceResult.push(reportData);
            }
        }
        resStatus = bundleStructure.setResponse({ link: config.baseUrl + "Encounter", reqQuery: queryParams, allowNesting: 1, specialOffset: 1 }, responseData);            
             
        res.status(200).json({ status: resStatus, message: "Data fetched.", total: resourceResult.length,"offset": +queryParams?._offset, data: resourceResult  })
    }
    catch (error) {
        console.error("getLabReport Error: " ,error);
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

const deleteDiagnosticReportResources = async (diagReportData, documentReferenceData) => {
    const deleteDiagReportList = [];
    for(let diag of diagReportData){
        let diagData = new DiagnosticReport({}, diag).deleteDiagnosticReport();
        let diagReportDeleteBundle = await bundleStructure.setBundlePut(diagData, diagData.identifier, diagData.id, 'PUT'); 
        deleteDiagReportList.push(diagReportDeleteBundle);
        let documents = diagData?.extension || [];
        for(let doc of documents){
            let docId = doc?.valueReference?.reference?.split('/')[1];
            let docResource = documentReferenceData.find((d) => d.id == docId);
            let docData = new DocumentReference({}, docResource).deleteDocument();
            let documentReferenceDeleteBundle = await bundleStructure.setBundlePut(docData, docData.identifier, docData.id, 'PUT'); 
            deleteDiagReportList.push(documentReferenceDeleteBundle)
        }
    } 
    return deleteDiagReportList;
}

const deleteLabReport = async (req, res) => {
    try {
        let diagReportIds = req.body.join(',');
        let diagReportData = await fetchResource("DiagnosticReport", { _id: diagReportIds, _count: 5000});
        diagReportData = diagReportData?.entry?.map((e) => e?.resource) || [];
        const encounterIds = diagReportData.map((e) => e.encounter.reference.split('/')[1]).join(",");
        let encounterData = await fetchResource("Encounter", { _id: encounterIds, _count: 5000});
        encounterData = encounterData?.entry?.map((e) => e?.resource) || [];
        const deleteEncList = await deleteEncounter(encounterData);
        let documentReferenceIds = [];
        diagReportData.forEach((diag) => {
            let documents = diag?.extension || [];
            documents.forEach((doc) => {
                let docId = doc.valueReference.reference.split('/')[1];
                documentReferenceIds.push(docId);
            });
        });
        documentReferenceIds = documentReferenceIds.join(',');
        let documentReferenceData = await fetchResource("DocumentReference", { _id: documentReferenceIds, _count: 5000});
        documentReferenceData = documentReferenceData?.entry?.map((e) => e?.resource) || [];
        const deleteDiagReport = await deleteDiagnosticReportResources(diagReportData, documentReferenceData);
        const resourceResult = [...deleteEncList, ...deleteDiagReport]
        let bundleData = await bundleStructure.getBundleJSON({resourceResult})  
        let response = await axios.post(config.baseUrl, bundleData.bundle); 
        console.info("get bundle json response: ", response)  
        if (response.status == 200) {
            let responseData = setDeleteLabReportResponse(bundleData.bundle.entry, response.data.entry, "delete");        
            console.info(responseData)
            res.status(201).json({ status: 1, message: "Lab report deleted.", data: responseData })
        }
        else {
            return handleError(res, response);
        }

    }
    catch (error) {
        console.error("deleteLabReport Error: " ,error);
        return handleError(res, error);
    }
}


const fetchDocumentData = (documents) => {
    let result = [];
    for(let document of documents){
        console.info(document.resource)
        let documentData = getTransformedResult(DocumentReference, document.resource);
        result.push(documentData)
    }
    return result;
}

const setLabReportResponse  = (reqBundleData, responseBundleData, type) => {
    let filteredData = [];
    let response = [];
    const responseData = bundleStructure.mapBundleService(reqBundleData, responseBundleData)

    filteredData = responseData.filter(e => e.resource.resourceType == "DiagnosticReport");
    let documentRefs = responseData.filter(e => e.resource.resourceType == "DocumentReference");
    filteredData = filteredData.map((e) => {
        e.documents = [];
        e?.resource?.extension?.forEach((m) => {
            let doc = documentRefs.find((d) => { return d.resource.id == m.valueReference.reference.split('/')[1].split(':')[2] });
            e.documents.push({
                labDocumentfhirId: doc.response.location.split('/')[1],
                labDocumentUuid: doc.resource.id,
            });
        });
        return e;
    });

    response = responseService.setDefaultResponse("DiagnosticReport", type, filteredData)
    for(let i=0; i<response.length; i++) {
        response[i].files = filteredData[i].documents || []
    }
    return response;
}

const setDeleteLabReportResponse = (reqBundleData, responseBundleData) => {
    let filteredData = [];
    let response = [];
    const responseData = bundleStructure.mapBundleService(reqBundleData, responseBundleData)

    filteredData = responseData.filter(e => e.request.url.split('/')[0] == "DiagnosticReport");
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
    saveLabReport,
    getLabReport,
    deleteLabReport
}