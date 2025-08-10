let ActivityDefinition = require("../class/InterventionActivityDefinition");
const {buildFHIRResource, fetchResource, handleError, getTransformedResult, patchFHIRResource} = require("../services/helperFunctions");
let axios = require("axios");
let config = require("../config/nodeConfig");
const bundleStructure = require("../services/bundleOperation")
const responseService = require("../services/responseService");
// let {InterventionSaveSchema} = require("../utils/Validator/InterventionValidator");
// const {validateRequest} = require("../utils/validateRequest");

//  save Intervention data
let saveInterventionData = async function (req, res) {    
    try {
        // const validatedBody = validateRequest(req.body, InterventionSaveSchema, res);
        // if (!validatedBody) return;
        req.queueMeta = {
            data: req.data,
            entity: "intervention",
            requestType: "post",
            apiName: "add-Intervention",
            tokenData: req.decoded
          };
        const token = req.accessToken;
        let resourceResult = [];
        let interventionResource = null;
        console.log("req body: ", req.body)
        for (let interventionData of req.body) {
                const previousInterventionCheck = await fetchResource("ActivityDefinition", {identifier: interventionData.code, topic: "384758001"}, token);
                if(previousInterventionCheck.entry && previousInterventionCheck.entry.length > 0)  {
                    return res.status(400).json({ status: 0, message: "Intervention with given code already exists." })
                }              
                interventionResource = buildFHIRResource(ActivityDefinition, interventionData)
           
            console.log("InterventionId: ", interventionResource);     
            let InterventionBundle = await bundleStructure.setBundlePost(interventionResource, interventionResource.identifier, interventionData.uuid, "POST", "identifier");
            console.info("Intervention bundle: ", InterventionBundle)                           
            resourceResult.push(InterventionBundle);   
        }
        let bundleData = await bundleStructure.getBundleJSON({resourceResult});
        // return res.status(201).json({ status: 1, message: "Intervention data saved.", data: bundleData.bundle })  
        console.info("main bundle transaction resource: ", bundleData)
        let response = await axios.post(config.baseUrl, bundleData.bundle, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/fhir+json'
            }
        }); 
        console.log("get bundle json response: ", response)  
        if (response.status == 200 || response.status == 201) {
            let resourceResponse = setInterventionSaveResponse(bundleData.bundle.entry, response.data.entry, "post");
            let responseData = [...resourceResponse, ...bundleData.errData];
            return res.status(201).json({ status: 1, message: "Intervention data saved.", data: responseData })
        }
        else {
            return handleError(res, response)
        }
    }
    catch (error) {
        console.error("saveInterventionData Error: ", error);
        error.code && error.code == "ERR" ? handleError(res, error, error.statusCode, error.message ) :  handleError(res, error)

    }

}

//  save Intervention data
let updateInterventionData = async function (req, res) {    
    try {
        // const validatedBody = validateRequest(req.body, InterventionSaveSchema, res);
        // if (!validatedBody) return;
        let resourceResult = [];
        let interventionResource = null;
        req.queueMeta = {
            data: req.data,
            entity: "intervention",
            requestType: "put",
            apiName: "update-intervention",
            tokenData: req.decoded
          };
        const token = req.accessToken;
        console.log("req body: ", req.body)
        for (let interventionData of req.body) {
            const previousInterventionCheck = await fetchResource("ActivityDefinition", {identifier: interventionData.code, topic: "384758001"}, token);
                if(previousInterventionCheck.entry && previousInterventionCheck.entry.length > 1)  {
                    return res.status(400).json({ status: 0, message: "Intervention with given code already exists." })
                }  
              
                interventionResource = buildFHIRResource(ActivityDefinition, interventionData);
                interventionResource.id = interventionData.fhirId
            console.log("InterventionId: ", interventionResource);     
            let InterventionBundle = await bundleStructure.setBundlePut(interventionResource, null, interventionData.fhirId, "PUT", "identifier");
            console.info("Intervention bundle: ", InterventionBundle)                           
            resourceResult.push(InterventionBundle);   
        }
        let bundleData = await bundleStructure.getBundleJSON({resourceResult});
        // return res.status(201).json({ status: 1, message: "Intervention data saved.", data: bundleData.bundle })  
        console.info("main bundle transaction resource: ", bundleData)
        let response = await axios.post(config.baseUrl, bundleData.bundle, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/fhir+json'
            }
        }); 
        console.log("get bundle json response: ", response)  
        if (response.status == 200 || response.status == 201) {
            let resourceResponse = setInterventionSaveResponse(bundleData.bundle.entry, response.data.entry, "post");
            let responseData = [...resourceResponse, ...bundleData.errData];
            responseData[0].id = null;
            return res.status(201).json({ status: 1, message: "Intervention data saved.", data: responseData })
        }
        else {
            return handleError(res, response)
        }
    }
    catch (error) {
        console.error("saveInterventionData Error: ", error);
        error.code && error.code == "ERR" ? handleError(res, error, error.statusCode, error.message ) :  handleError(res, error)

    }

}

const setInterventionSaveResponse  = (reqBundleData, responseBundleData, type) => {
    let filteredData = [];
    let response = [];
    const responseData = bundleStructure.mapBundleService(reqBundleData, responseBundleData)
    filteredData = responseData.filter(e => (e.resource.resourceType == "ActivityDefinition")|| (type == "patch" && e.resource.resourceType == "Binary"));
    response = responseService.setDefaultResponse("ActivityDefinition", type, filteredData);
    return response;
}

let getInterventionData = async function (req, res) {
    try {
        const link = config.baseUrl + "ActivityDefinition"
        const queryParams = req.query;
        queryParams.topic = "384758001"
        let resStatus = 1;
        const token = req.accessToken;
        queryParams._total = "accurate"
        let resourceResult = [];
        console.log("queryParams: ", queryParams)
        const responseResult = await fetchResource("ActivityDefinition", queryParams, token);
        const responseData = responseResult.entry || []
        if( !responseData) {
            return res.status(200).json({ status: resStatus, message: "Data fetched", total: 0, data: []  })
        }
        else {            
            resStatus = bundleStructure.setResponse({ link: link, reqQuery: queryParams, allowNesting: 1, specialOffset: 1 }, responseResult);            
            for (let i = 0; i < responseData.length; i++) {
                const location = getTransformedResult(ActivityDefinition, responseData[i].resource);
                resourceResult.push(location)                
            }
        }
        return res.status(200).json({ status: resStatus, message: "Data fetched.", total: resourceResult.length,"offset": +queryParams?._offset, data: resourceResult  })
       
    }
    catch(error) {
        console.error("getInterventionData Error",error)
        return handleError(res, error);       
    }
}

const patchInterventionData = async function(req, res) {
    try {
        // const validatedBody = validateRequest(req.body, InterventionPatchSchema, res);
        // if (!validatedBody) return;
        const resourceType = "ActivityDefinition";
        const reqInput = req.body;
        const token = req.accessToken;
        let resourceResult = [];
      for (let inputData of reqInput) {
        const resourceSavedResult = await fetchResource(resourceType, {_id: inputData.fhirId }, token)
        const resourceSavedData = resourceSavedResult.entry || [];
        if (resourceSavedData.length != 1) {
            const statusCode = 500
            return handleError(res, "Intervention Id " + inputData.fhirId + " does not exist.", statusCode, "Intervention Id " + inputData.fhirId + " does not exist.")
        }        
        const InterventionPatchResource = patchFHIRResource(ActivityDefinition, inputData, resourceSavedData[0].resource)
        console.log("InterventionPatchResource: ", InterventionPatchResource)
        let resourceData = [...InterventionPatchResource];
        let patchResource = await bundleStructure.setBundlePatch(resourceData,resourceType + "/"+inputData.fhirId);        
        resourceResult.push(patchResource);
       
      }
    const bundleData = await bundleStructure.getBundleJSON({resourceResult: resourceResult, errData: []})  
    console.info(bundleData)
    // return res.status(201).json({ status: 1, message: "Intervention name updated.", data: bundleData.bundle })  
    const response = await axios.post(config.baseUrl, bundleData.bundle, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/fhir+json'
        }
    }); 
    console.log("get bundle json response: ", response.status)  
    if (response.status == 200 || response.status == 201) {
        let resourceResponse = setInterventionSaveResponse(bundleData.bundle.entry, response.data.entry, "patch");
        const responseData = [...resourceResponse, ...bundleData.errData];
        res.status(201).json({ status: 1, message: "Intervention status updated.", data: responseData })
    }
    else {
        return handleError(res, response)
    }
    }  catch(error) {
            console.error("patchInterventionData Error",error)
            return handleError(res, error)
    }
}


module.exports = {
    saveInterventionData,
    getInterventionData,
    patchInterventionData,
    updateInterventionData
}