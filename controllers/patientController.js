
let Person = require("../class/person");

let Patient = require("../class/patient");

let axios = require("axios");
let config = require("../config/nodeConfig");
const { v4: uuidv4 } = require('uuid');
const bundleStructure = require("../services/bundleOperation")
const responseService = require("../services/responseService");
// let resourceValid = require("../utils/Validator/validateRsource").resourceValidation;
let ImmunizationRecommendation = require('../class/ImmunizationRecommendation');
const vaccines = require('../utils/vaccines.json');


//  save patient data
let savePatientData = async function (req, res) {
    try {
        let token = req.token;
        
        let resourceResult = [];
        console.log("req body: ", req.body)
        for (let patientData of req.body) {
            let patient = new Patient(patientData, {}, token);
            patient.getJsonToFhirTranslator();
            let patientResource = {};
            patientResource = { ...patient.getFHIRResource() };
            patientResource.resourceType = "Patient";
            let personInput = { patientId: patientData.id };
            let person1 = new Person(personInput, {});
            patient.setBasicStructure();
            patient.setLink(patientData.id);
            patient.setSpouseName(patientData.spouseName);
            patient.setMothersName(patientData.mothersName);
            patient.setFathersName(patientData.setFathersName)
            let personResource = { ...person1.getFHIRResource() };
            personResource.identifier = patientResource.identifier;
            personResource.resourceType = "Person";
            personResource.id = uuidv4();            
            let patientBundle = await bundleStructure.setBundlePost(patientResource, patientResource.identifier, patientData.id, "POST", "identifier");
            console.info("patient bundle: ", patientBundle)
            let personBundle = await bundleStructure.setBundlePost(personResource, null, personResource.id, "POST", "identifier");
            if (!('blockImmunization' in patientData)) {
                let immunizationResources = await createImmunizationData(patientData, token)
                resourceResult = resourceResult.concat(immunizationResources)
            }
                
            resourceResult.push(patientBundle, personBundle);            
        }
        let bundleData = await bundleStructure.getBundleJSON({resourceResult})  
        console.info("main bundle transaction resource: ", bundleData)
        let response = await axios.post(config.baseUrl, bundleData.bundle); 
        console.log("get bundle json response: ", response.status)  
        if (response.status == 200 || response.status == 201) {
            let resourceResponse = setPatientSaveResponse(bundleData.bundle.entry, response.data.entry, "post");
            let responseData = [...resourceResponse, ...bundleData.errData];
            res.status(201).json({ status: 1, message: "Patient data saved.", data: responseData })
        }
        else {
            return res.status(500).json({
                    status: 0, message: "Unable to process. Please try again.", error: response
            })
        }
    }
    catch (e) {
        console.error(e);
        if (e.code && e.code == "ERR") {
            let statusCode = e.statusCode ? e.statusCode : 500;
            return res.status(statusCode).json({
                status: 0,
                message: e.message
            })
        }
        return res.status(500).json({
            status: 0,
            message: "Unable to process. Please try again.",
            error: e
        })
    }

}

const createImmunizationData = async function(patientData, token) {
    let immunizationResources = []
    const vaccineCodes = Object.keys(vaccines);

    for (let code of vaccineCodes) {
        let ImmunizationRecommendationResource = new ImmunizationRecommendation({
            patientId: patientData.id,
            orgId: token.orgId,
            code: code,
            birthDate: patientData.birthDate
        }, {});
        ImmunizationRecommendationResource = ImmunizationRecommendationResource.getJsonToFhirTranslator();
        let ImmunizationRecommendationBundle = await bundleStructure.setBundlePost(ImmunizationRecommendationResource, null, ImmunizationRecommendationResource.id, "POST", "identifier");
        immunizationResources.push(ImmunizationRecommendationBundle);
    }

    return immunizationResources
}

const setPatientSaveResponse  = (reqBundleData, responseBundleData, type) => {
    let filteredData = [];
    let response = [];
    const responseData = bundleStructure.mapBundleService(reqBundleData, responseBundleData)
    filteredData = responseData.filter(e => e.resource.resourceType == "Patient" || (type == "patch" && e.resource.resourceType == "Binary"));
    response = responseService.setDefaultResponse("Patient", "post", filteredData);
    return response;
}

let getPatientData = async function (req, res) {
    try {
        const link = config.baseUrl + "Patient"
        let specialOffset = null;
        let queryParams = req.query
        queryParams._total = "accurate"
        queryParams['organization'] = "Organization/"+req.token.orgId;
        let resourceResult = []
        let resourceUrlData = { link: link, reqQuery: queryParams, allowNesting: 1, specialOffset: specialOffset }
        let responseData = await bundleStructure.searchData(link, queryParams);
        let resStatus = 1;
        console.info("==================>", responseData.data)
        if( !responseData.data.entry || responseData.data.total == 0) {
                return res.status(200).json({ status: resStatus, message: "Data fetched", total: 0, data: []  })
        }
        else {            
            resStatus = bundleStructure.setResponse(resourceUrlData, responseData);
            
            for (let i = 0; i < responseData.data.entry.length; i++) {
                let patient = new Person({}, responseData.data.entry[i].resource, req.token);
                patient.getFHIRToUserInput();
                resourceResult.push(patient.getPersonResource())                
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

const patchPatientData = async function(req, res) {
    try {
      // let response = resourceValid(req.params);
      // if (response.error) {
      //     console.error(response.error.details)
      //     let errData = { status: 0, response: { data: response.error.details }, message: "Invalid input" }
      //     return res.status(422).json(errData);
      // }
      const resourceType = "Patient";
      const reqInput = req.body;
      let resourceResult = [];
      for (let inputData of reqInput) {
        let patient = new Person(inputData, []);
        let link = config.baseUrl + resourceType;
        let resourceSavedData = await bundleStructure.searchData(link, {_id: inputData.id });
        if (resourceSavedData.data.total != 1) {
          return res.status(500).json({
            status: 0,
            message: "Patient Id " + inputData.id + " does not exist.",
            statusCode: 500,
          });
        }
        patient.patchUserInputToFHIR(resourceSavedData.data.entry[0].resource);
        let resourceData = [...patient.getFHIRResource()];
        const patchUrl = resourceType + "/" + inputData.id;
        let patchResource = await bundleStructure.setBundlePatch(
          resourceData,
          patchUrl
        );
        resourceResult.push(patchResource);
        if (inputData?.birthDate) {
            let immunizationPatchResources = await immunizationPatch(inputData)
            resourceResult = resourceResult.concat(immunizationPatchResources)
        }
      }
    console.info(resourceResult)
    const resourceData = {resourceResult: resourceResult, errData: []}
    let bundleData = await bundleStructure.getBundleJSON(resourceData)  
    console.info(bundleData)
    let response = await axios.post(config.baseUrl, bundleData.bundle); 
    console.log("get bundle json response: ", response.status)  
    if (response.status == 200 || response.status == 201) {
        let resourceResponse = setPatientSaveResponse(bundleData.bundle.entry, response.data.entry, "patch");
        let responseData = [...resourceResponse, ...bundleData.errData];
        res.status(201).json({ status: 1, message: "Patient data saved.", data: responseData })
    }
    else {
        return res.status(500).json({
        status: 0, message: "Unable to process. Please try again.", error: response
        })
    }
    }  catch(e) {
            console.error("Error",e)
            return res.status(200).json({
                    status: 0,
                    message: "Unable to process. Please try again"
                }) 
    }
}

const immunizationPatch = async function (inputData) {
    let resourceResult = [];
    let immunizationRecommendationData = await bundleStructure.searchData(
        config.baseUrl + "ImmunizationRecommendation",
        { patient: inputData.id }
      );
      immunizationRecommendationData = immunizationRecommendationData?.data?.entry?.map((e) => e.resource) || [];
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
    patchPatientData
}