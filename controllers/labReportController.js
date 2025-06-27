const DiagnosticReport = require("../class/DiagnosticReport");
const DocumentReference = require("../class/BaseDocumentReference");
const Encounter = require("../class/BaseEncounter");
let axios = require("axios");
let config = require("../config/nodeConfig");
const bundleStructure = require("../services/bundleOperation")
const responseService = require("../services/responseService");
const { v4: uuidv4 } = require('uuid');

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
            let encounterData = await bundleStructure.searchData(config.baseUrl + "Encounter", { "appointment": labReport.appointmentId, _count: 5000 , "_include": "Encounter:appointment" });
            let encounterUuid = uuidv4();
            let encounter = new Encounter({ 
                    id: encounterUuid,
                    uuid: encounterUuid,
                    encounterId: encounterData.data.entry[0].resource.id,
                    patientId: labReport.patientId,
                    practitionerId: req.decoded.userId,
                    createdOn: labReport.createdOn,
                    orgId: req.decoded.orgId
            }, {}).getUserInputToFhirForLabReport();
            let encounterBundle = await bundleStructure.setBundlePost(encounter, encounter.identifier, encounter.id, "POST", "identifier");
            resourceResult.push(encounterBundle);
            labReport.encounterId = encounter.id;
            let documents = [];
            for(let file of labReport.files) {
                let document = new DocumentReference({
                    uuid: file.labDocumentUuid,
                    filename: file.filename, 
                    note: file.note
                }, {}).getJSONtoFhir();
                documents.push(document);
                document = await bundleStructure.setBundlePost(document, document.identifier, document.id, "POST", "identifier");
                resourceResult.push(document);
            }
            labReport.documents = documents;
            let report = new DiagnosticReport(labReport, {}).getUserInputToFhir(); 
            report = await bundleStructure.setBundlePost(report, null, labReport.diagnosticUuid, "POST", "identifier");
            resourceResult.push(report);
        }
        let bundleData = await bundleStructure.getBundleJSON({resourceResult})  
        let response = await axios.post(config.baseUrl, bundleData.bundle); 
        console.info("get bundle json response: ", response.status)  
        if (response.status == 200 || response.status == 201) {
            let responseData = setLabReportResponse(bundleData.bundle.entry, response.data.entry, "post");        

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
let getLabReport = async function (req, res) {
    try {
        const link = config.baseUrl + "Encounter";
        let queryParams = {
            _revinclude : "DiagnosticReport:encounter:Encounter",
            type :  "lab-report-encounter",
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
        
            let reportList = FHIRData.filter(e => e.resource.resourceType == "DiagnosticReport" && e.resource.encounter.reference == "Encounter/"+encounter.id).map(e => e.resource);
            reportData.diagnosticReport = [];
            for(let diagnosticReport of reportList){
                let data = new DiagnosticReport(reportData ,diagnosticReport).getFHIRToUserData();
                console.log("documentIds", data.documentIds);
                if(data.documentIds.length > 0){
                    let documentReferenceResponse = await bundleStructure.searchData(config.baseUrl + "DocumentReference", { "_id": data.documentIds.join(','), _count: 5000 });
                    let documentReferenceData = documentReferenceResponse.data.entry;
                    data.documents = fetchDocumentData(documentReferenceData);
                    delete data.documentIds;
                    reportData.diagnosticReport.push(data);
                }
                else {
                    delete data.documentIds;
                    data.documents = [];
                    reportData.diagnosticReport.push(data);
                }
            }
            delete reportData.labReport;
            if(reportData.diagnosticReport.length > 0){
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

const deleteLabReport = async (req, res) => {
    try {
        let diagReportIds = req.body.join(',');
        let resourceResult = [];
        let diagReportData = await bundleStructure.searchData(config.baseUrl + "DiagnosticReport", { _id: diagReportIds, _count: 5000});
        diagReportData = diagReportData?.data?.entry?.map((e) => e?.resource) || [];
        let encounterIds = diagReportData.map((e) => e.encounter.reference.split('/')[1]);
        encounterIds = encounterIds.join(',');
        let encounterData = await bundleStructure.searchData(config.baseUrl + "Encounter", { _id: encounterIds, _count: 5000});
        encounterData = encounterData?.data?.entry?.map((e) => e?.resource) || [];
        for(let enc of encounterData){
            let encounter = new Encounter({}, enc).deleteEncounter();
            let encounterDeleteBundle = await bundleStructure.setBundlePut(encounter, encounter.identifier, encounter.id, 'PUT'); 
            resourceResult.push(encounterDeleteBundle);
        }
        let documentReferenceIds = [];
        diagReportData.forEach((diag) => {
            let documents = diag?.extension || [];
            documents.forEach((doc) => {
                let docId = doc.valueReference.reference.split('/')[1];
                documentReferenceIds.push(docId);
            });
        });
        documentReferenceIds = documentReferenceIds.join(',');
        let documentReferenceData = await bundleStructure.searchData(config.baseUrl + "DocumentReference", { _id: documentReferenceIds, _count: 5000});
        documentReferenceData = documentReferenceData?.data?.entry?.map((e) => e?.resource) || [];
        for(let diag of diagReportData){
            let diagData = new DiagnosticReport({}, diag).deleteDiagnosticReport();
            let diagReportDeleteBundle = await bundleStructure.setBundlePut(diagData, diagData.identifier, diagData.id, 'PUT'); 
            resourceResult.push(diagReportDeleteBundle);
            let documents = diagData?.extension || [];
            for(let doc of documents){
                let docId = doc?.valueReference?.reference?.split('/')[1];
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
            let responseData = setDeleteLabReportResponse(bundleData.bundle.entry, response.data.entry, "delete");        
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
        let documentData = new DocumentReference({}, document.resource).getFHIRToJSONForLabReport();
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