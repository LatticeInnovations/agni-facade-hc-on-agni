
let Person = require("../class/person");
let Patient = require("../class/patient");
const {buildFHIRResource, fetchResource, handleError, getTransformedResult, patchFHIRResource} = require("../services/helperFunctions");
let axios = require("axios");
let config = require("../config/nodeConfig");
const { v4: uuidv4 } = require('uuid');
const bundleStructure = require("../services/bundleOperation")
const responseService = require("../services/responseService");
let {patientSaveSchema, patientPatchSchema} = require("../utils/Validator/patientValidator");
const {validateRequest} = require("../utils/validateRequest");
const Observation = require("../class/BaseObservation");
const heartcareUrls = require("../utils/heartcareSystemUrl")
//  save patient data
let savePatientData = async function (req, res) {    
    try {
        const validatedBody = validateRequest(req.body, patientSaveSchema, res);
        if (!validatedBody) return;
        let token= req.accessToken
        req.queueMeta = {
            data: req.body,
            entity: "patients",
            requestType: "post",
            apiName: "save-patient",
            tokenData: req.decoded
          };
        let resourceResult = [];
        for (let patientData of req.body) {
            // patientData.orgId = token.orgId;
            patientData.userId = req.decoded.userId;
            let patientResource = buildFHIRResource(Patient, patientData)
            const personId = uuidv4();
            console.log("patientId: ", patientData.id)
            let personResource = buildFHIRResource(Person, {patientId: patientData.id, id: personId})

            let patientBundle = await bundleStructure.setBundlePost(patientResource, [patientResource.identifier[0]], patientData.id, "POST", "identifier");
            console.info("patient bundle: ", patientBundle)
            let personBundle = await bundleStructure.setBundlePost(personResource, null, personId, "POST", "identifier");
            const observationUuid = uuidv4();
            const observationResource = buildFHIRResource(Observation, {categoryCode: "deceased-reason", categoryDisplay: "deceased-reason", patientUuid: patientData.id, practitionerId: req.decoded.userId, patientDeceasedReasonId: null, patientDeceasedReason: patientData.patientDeceasedReason})
            const deceasedBundle = await bundleStructure.setBundlePost(observationResource, null, observationUuid, "POST", "identifier");
            resourceResult.push(patientBundle, personBundle, deceasedBundle);            
        }
        let bundleData = await bundleStructure.getBundleJSON({resourceResult});
        // return res.status(201).json({ status: 1, message: "Patient data saved.", data: bundleData.bundle })  
        console.info("main bundle transaction resource: ", bundleData, token)
        let response = await axios.post(config.baseUrl, bundleData.bundle, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/fhir+json'
            }
        });  
        if (response.status == 200 || response.status == 201) {
            let resourceResponse = setPatientSaveResponse(bundleData.bundle.entry, response.data.entry, "post");
            let responseData = [...resourceResponse, ...bundleData.errData];
            return res.status(201).json({ status: 1, message: "Patient data saved.", data: responseData })
        }
        else {
            return handleError(res, response)
        }
    }
    catch (error) {
        console.error("savePatientData Error: ", error);
        error.code && error.code == "ERR" ? handleError(res, error, error.statusCode, error.message ) :  handleError(res, error)

    }

}

let updatePatientData = async function(req, res) {
    try {
        req.queueMeta = {
            data: req.data,
            entity: "patients",
            requestType: "put",
            apiName: "update-patient",
            tokenData: req.decoded
          };
        let resourceResult = [];
        const token = req.accessToken;
        const patientIds = req.body.map(e => e.fhirId).join(",")       
        const deceasedResources = await fetchResource("Observation", {patient: patientIds, category: "deceased-reason", _count:1000}, token)
        const patientResources = await fetchResource("Patient", {_id: patientIds, _count: 1000}, token)
        for (let patientData of req.body) {
            let patientPrevData = patientResources.entry.find(e => e.resource.id == patientData.fhirId)
            const identifierData = patientPrevData.resource.identifier.find(e => e.system === heartcareUrls.heartCareIdUrl)
            const agni_uuid = patientPrevData.resource.identifier.find(e => e.system === "https://www.thelattice.in/")
               let deceasedBundle = null;
            patientData.id = agni_uuid.value;
            patientData.userId = req.decoded.userId;
            // patientData.orgId = req.decoded.orgId;
            patientData.heartcareId = identifierData?.value || null
            const patientResource = buildFHIRResource(Patient, patientData)
            let patientBundle = await bundleStructure.setBundlePut(patientResource, patientResource.identifier, patientData.fhirId, "put", "identifier");
            // Add deceased response
             const deceasedData = deceasedResources.entry.find(e => e.resource.subject.reference.split("/")[1] == patientData.fhirId)
            const observationResource = buildFHIRResource(Observation, {categoryCode: "deceased-reason", categoryDisplay: "deceased-reason", patientId: patientData.fhirId, practitionerId: req.decoded.userId, patientDeceasedReasonId: patientData.patientDeceasedReasonId, patientDeceasedReason: patientData.patientDeceasedReason});
            if(deceasedData) {
                observationResource.id = deceasedData.resource.id
                deceasedBundle = await bundleStructure.setBundlePut(observationResource, null, observationResource.id, "PUT", "identifier");
            }
            else {
                const observationUuid = uuidv4();
                deceasedBundle = await bundleStructure.setBundlePost(observationResource, null, observationUuid, "POST", "identifier");
 
            }
            
            resourceResult.push(patientBundle, deceasedBundle);            
        }
        let bundleData = await bundleStructure.getBundleJSON({resourceResult})  
        // return res.status(201).json({ status: 1, message: "Patient data updated.", data: bundleData.bundle })
        console.info("main bundle transaction resource: ", bundleData)
        let response = await axios.post(config.baseUrl, bundleData.bundle, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/fhir+json'
            }
        }); 
        console.log("get bundle json response: ", response.status)  
        if (response.status == 200 || response.status == 201) {
            let resourceResponse = setPatientSaveResponse(bundleData.bundle.entry, response.data.entry, "put");
            let responseData = [...resourceResponse, ...bundleData.errData];
            res.status(201).json({ status: 1, message: "Patient data updated.", data: responseData })
        }
        else {
            handleError(res, response)
        }
    }
    catch (error) {
        console.error("updatePatientData Error: ", error);
        error.code && error.code == "ERR" ? handleError(res, error, error.statusCode, error.message ) :  handleError(res, error)

    }
}


const setPatientSaveResponse  = (reqBundleData, responseBundleData, type) => {
    let filteredData = [];
    let response = [];
    const responseData = bundleStructure.mapBundleService(reqBundleData, responseBundleData)
    filteredData = responseData.filter(e => e.resource.resourceType == "Patient" || (type == "patch" && e.resource.resourceType == "Binary"));
    response = responseService.setDefaultResponse("Patient", type, filteredData);
    return response;
}

let getPatientData = async function (req, res) {
    try {
        const link = config.baseUrl + "Patient"
        const queryParams = req.query;
        let resStatus = 1;
        queryParams._total = "accurate";
        let resourceResult = []
        const token = req.accessToken;
        const responseResult = await fetchResource("Patient", queryParams, token);
        const responseData = responseResult.entry || [];
        if(!responseData.length) {
            return res.status(200).json({ status: 2, message: "Data fetched", total: 0, data: []  })
        }
        else {            
            resStatus = bundleStructure.setResponse({ link: link, reqQuery: queryParams, allowNesting: 1, specialOffset: true }, responseResult);  
            const patientIds = responseData.map(e => e.resource.id)   .join(",")       
            const deceasedResources = await fetchResource("Observation", {patient: patientIds, category: "deceased-reason", _count: req.query._count}, token)
            for (let i = 0; i < responseData.length; i++) {
                const patient = getTransformedResult(Patient, responseData[i].resource);
                const deceasedData = deceasedResources.entry? deceasedResources.entry.find(e => e.resource.subject.reference.split("/")[1] == patient.fhirId) : null;
                const deceasedObject = deceasedData? getTransformedResult(Observation, deceasedData?.resource) : null;
                patient.patientDeceasedReasonId = deceasedObject?.patientDeceasedReasonId || null;
                patient.patientDeceasedReason =deceasedObject?.patientDeceasedReason || null
                resourceResult.push(patient)                
            }
        }
        return res.status(200).json({ status: resStatus, message: "Data fetched.", total: resourceResult.length,"offset": +queryParams?._offset, data: resourceResult  })
       
    }
    catch(error) {
        console.error("getPatientData Error",error)
        return handleError(res, error);       
    }
}

const patchPatientData = async function(req, res) {
    try {
        const validatedBody = validateRequest(req.body, patientPatchSchema, res);
        if (!validatedBody) return;
        const resourceType = "Patient";
        const reqInput = req.body;
        const token = req.accessToken;
        let resourceResult = [];
        for (let inputData of reqInput) {
            const resourceSavedResult = await fetchResource(resourceType, {_id: inputData.fhirId }, token)
            const resourceSavedData = resourceSavedResult.entry || [];
            if (resourceSavedData.length != 1) {
                const statusCode = 500
                return handleError(res, "Patient Id " + inputData.fhirId + " does not exist.", statusCode, "Patient Id " + inputData.fhirId + " does not exist.")
            }    
            
            if("heartcareId" in inputData) {
                const heartcareIndex = resourceSavedData[0].resource.identifier.findIndex(e => e.system === heartcareUrls.heartCareIdUrl)
                inputData.heartcareId = {
                    "operation": heartcareIndex == -1 ? inputData.heartcareId.operation: "replace",
                    "path": heartcareIndex == -1 ? "/identifier/"+ resourceSavedData[0].resource.identifier.length: "/identifier/" + heartcareIndex,
                    "value": inputData.heartcareId.value
                }
            }
            const patientPatchResource = patchFHIRResource(Patient, inputData, resourceSavedData[0].resource)
            let resourceData = [...patientPatchResource];
            let patchResource = await bundleStructure.setBundlePatch(resourceData,resourceType + "/"+inputData.fhirId);     
            //  deleted a user reason   
            resourceResult.push(patchResource);
      
        }
    const bundleData = await bundleStructure.getBundleJSON({resourceResult: resourceResult, errData: []})  
    console.info(bundleData)
    const response = await axios.post(config.baseUrl, bundleData.bundle, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/fhir+json'
        }
    }); 
    console.log("get bundle json response: ", response.status)  
    if (response.status == 200 || response.status == 201) {
        let resourceResponse = setPatientSaveResponse(bundleData.bundle.entry, response.data.entry, "patch");
        const responseData = [...resourceResponse, ...bundleData.errData];
        res.status(201).json({ status: 1, message: "Patient data saved.", data: responseData })
    }
    else {
        return handleError(res, response)
    }
    }  catch(error) {
            console.error("patchPatientData Error",error)
            return handleError(res, error)
    }
}


module.exports = {
    savePatientData,
    getPatientData,
    patchPatientData,
    updatePatientData
}