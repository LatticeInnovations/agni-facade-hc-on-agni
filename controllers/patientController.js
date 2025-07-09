
let Person = require("../class/person");
let Patient = require("../class/patient");
const {buildFHIRResource, fetchResource, handleError, getTransformedResult, patchFHIRResource} = require("../services/helperFunctions");
let axios = require("axios");
let config = require("../config/nodeConfig");
const { v4: uuidv4 } = require('uuid');
const bundleStructure = require("../services/bundleOperation")
const responseService = require("../services/responseService");
let ImmunizationRecommendation = require('../class/ImmunizationRecommendation');
const vaccines = require('../utils/vaccines.json');
let {patientSaveSchema, patientPatchSchema} = require("../utils/Validator/patientValidator");
const {validateRequest} = require("../utils/validateRequest");
const Observation = require("../class/BaseObservation");

//  save patient data
let savePatientData = async function (req, res) {    
    try {
        const validatedBody = validateRequest(req.body, patientSaveSchema, res);
        if (!validatedBody) return;
        let token = req.token;
        req.queueMeta = {
            data: req.data,
            entity: "patients",
            requestType: "post",
            apiName: "save-patient",
            tokenData: req.decoded
          };
        let resourceResult = [];
        console.log("req body: ", req.body)
        for (let patientData of req.body) {
            patientData.orgId = token.orgId;
            patientData.userId = token.userId;
            let patientResource = buildFHIRResource(Patient, patientData)
            const personId = uuidv4();
            console.log("patientId: ", patientData.id)
            let personResource = buildFHIRResource(Person, {patientId: patientData.id, id: personId})
            console.log("personResource: ", personResource)      
            let patientBundle = await bundleStructure.setBundlePost(patientResource, patientResource.identifier, patientData.id, "POST", "identifier");
            console.info("patient bundle: ", patientBundle)
            let personBundle = await bundleStructure.setBundlePost(personResource, null, personId, "POST", "identifier");
            const observationUuid = uuidv4();
            const observationResource = buildFHIRResource(Observation, {categoryCode: "deceased-reason", categoryDisplay: "deceased-reason", patientUuid: patientData.id, practitionerId: req.decoded.userId, patientDeceasedReasonId: null, patientDeceasedReason: patientData.patientDeceasedReason})
            const deceasedBundle = await bundleStructure.setBundlePost(observationResource, null, observationUuid, "POST", "identifier");
            resourceResult.push(patientBundle, personBundle, deceasedBundle);            
            console.log("observationResource: ", observationResource)
        }
        let bundleData = await bundleStructure.getBundleJSON({resourceResult});
        // return res.status(201).json({ status: 1, message: "Patient data saved.", data: bundleData.bundle })  
        console.info("main bundle transaction resource: ", bundleData)
        let response = await axios.post(config.baseUrl, bundleData.bundle); 
        console.log("get bundle json response: ", response)  
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
        console.log("req body: ", req.body)
        const patientIds = req.body.map(e => e.fhirId).join(",")       
        const deceasedResources = await fetchResource("Observation", {patient: patientIds, category: "deceased-reason"})
        console.log("deceasedResources: ", deceasedResources)
        for (let patientData of req.body) {
            let deceasedBundle = null
            patientData.userId = req.decoded.userId;
            patientData.orgId = req.decoded.orgId;
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
        let response = await axios.post(config.baseUrl, bundleData.bundle); 
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
        queryParams._total = "accurate"
        queryParams['organization'] = "Organization/"+req.token.orgId;
        let resourceResult = []
        const responseResult = await fetchResource("Patient", queryParams);
        const responseData = responseResult.entry || []
        console.log("==================>", responseData)
        if(!responseData.length) {
            return res.status(200).json({ status: 2, message: "Data fetched", total: 0, data: []  })
        }
        else {            
            resStatus = bundleStructure.setResponse({ link: link, reqQuery: queryParams, allowNesting: 1, specialOffset: true }, responseResult);  
            const patientIds = responseData.map(e => e.resource.id)   .join(",")       
            const deceasedResources = await fetchResource("Observation", {patient: patientIds, category: "deceased-reason"})
            console.log("deceasedResources: ", deceasedResources)
            for (let i = 0; i < responseData.length; i++) {
                console.log("check resource of patient: ", responseData[i].resource)
                const patient = getTransformedResult(Patient, responseData[i].resource);
                const deceasedData = deceasedResources.entry? deceasedResources.entry.find(e => e.resource.subject.reference.split("/")[1] == patient.fhirId) : null
                const deceasedObject = deceasedData? getTransformedResult(Observation, deceasedData?.resource) : null;
                console.log("deceasedObject: ", deceasedObject)
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
        let resourceResult = [];
      for (let inputData of reqInput) {
        const resourceSavedResult = await fetchResource(resourceType, {_id: inputData.id })
        const resourceSavedData = resourceSavedResult.entry || [];
        if (resourceSavedData.length != 1) {
            const statusCode = 500
            return handleError(res, "Patient Id " + inputData.id + " does not exist.", statusCode, "Patient Id " + inputData.id + " does not exist.")
        }        
        const patientPatchResource = patchFHIRResource(Patient, inputData, resourceSavedData[0].resource)
        let resourceData = [...patientPatchResource];
        let patchResource = await bundleStructure.setBundlePatch(resourceData,resourceType + "/"+inputData.id);     
        //  deleted a user reason   
        resourceResult.push(patchResource);
        //  Update immunization record
        if (inputData?.birthDate) {
            let immunizationPatchResources = await immunizationPatch(inputData)
            resourceResult = resourceResult.concat(immunizationPatchResources)
        }        
      }
    const bundleData = await bundleStructure.getBundleJSON({resourceResult: resourceResult, errData: []})  
    console.info(bundleData)
    const response = await axios.post(config.baseUrl, bundleData.bundle); 
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

const immunizationPatch = async function (inputData) {
    let resourceResult = [];
    let immunizationRecommendationData = await fetchResource("ImmunizationRecommendation",
        { patient: inputData.id })
      immunizationRecommendationData = immunizationRecommendationData?.entry?.map((e) => e.resource) || [];
      for (let fhirData of immunizationRecommendationData) {
        let patchImmunizationRecommendation = new ImmunizationRecommendation({ birthDate: inputData?.birthDate.value }, fhirData).patchImmunizationRecommendation();
        patchImmunizationRecommendation = await bundleStructure.setBundlePatch( patchImmunizationRecommendation,"ImmunizationRecommendation/" + fhirData.id);
        resourceResult.push(patchImmunizationRecommendation);
      }

      return resourceResult;
}


module.exports = {
    savePatientData,
    getPatientData,
    patchPatientData,
    updatePatientData
}