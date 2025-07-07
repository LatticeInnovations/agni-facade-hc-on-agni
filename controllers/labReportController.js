const DiagnosticReport = require("../class/DiagnosticReport");
const DocumentReference = require("../class/LabDocumentReference");
const Encounter = require("../class/GroupEncounter");
const BaseEncounter = require("../class/BaseEncounter");
let axios = require("axios");
let config = require("../config/nodeConfig");
const bundleStructure = require("../services/bundleOperation")
const responseService = require("../services/responseService");
const { v4: uuidv4 } = require('uuid');
const { fetchResource, buildFHIRResource, handleError, getTransformedResult } = require("../services/helperFunctions");
const { labReportArraySchema } = require("../utils/Validator/labReport");
const {validateRequest} = require("../utils/validateRequest");
const {deleteEncounter, createDocumentFiles, createEncounterResource, getDocumentReport} = require("../services/commonFunctions")


//  Save prescription File data
let saveLabReport = async function (req, res) {
    try {
        const validatedBody = validateRequest(req.body, labReportArraySchema, res);
        if (!validatedBody) return;
        let resourceResult = [];
        for(let labReport of req.body){ 
            const encounterUuid = uuidv4();
            const encounterBundle = await createEncounterResource(Encounter, labReport, {code: "lab-report-encounter", display: "Lab Report encounter"}, encounterUuid, req);
            resourceResult.push(encounterBundle);
            //  create labReport
            labReport.encounterId = encounterUuid

            const {documents, result} = await createDocumentFiles(DocumentReference, labReport, "labDocumentUuid")
            labReport.documents = documents;
            resourceResult = [...resourceResult, ...result];
            let report = buildFHIRResource(DiagnosticReport, labReport); 
            report = await bundleStructure.setBundlePost(report, null, labReport.diagnosticUuid, "POST", "identifier");
            resourceResult.push(report);
        }
        let bundleData = await bundleStructure.getBundleJSON({resourceResult}) ;
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
                return res.status(200).json({ status: 2, message: "Data fetched", total: 0, data: []  })
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

            reportData.diagnosticReport = await getDocumentReport(DiagnosticReport, DocumentReference, reportList, reportData)
 
            delete reportData.report;
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
        const deleteEncList = await deleteEncounter(Encounter, encounterData);
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