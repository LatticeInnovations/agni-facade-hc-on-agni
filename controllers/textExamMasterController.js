let ActivityDefinition = require("../class/TestExamActivityDefinition");
const {buildFHIRResource, fetchResource, handleError, getTransformedResult, patchFHIRResource} = require("../services/helperFunctions");
let axios = require("axios");
let config = require("../config/nodeConfig");
const bundleStructure = require("../services/bundleOperation")
const responseService = require("../services/responseService");
// let {TestExamSaveSchema} = require("../utils/Validator/TestExamValidator");
// const {validateRequest} = require("../utils/validateRequest");

//  save TestExam data
let saveTestExamData = async function (req, res) {    
    try {
        // const validatedBody = validateRequest(req.body, TestExamSaveSchema, res);
        // if (!validatedBody) return;
        req.queueMeta = {
            data: req.data,
            entity: "examinationMaster",
            requestType: "post",
            apiName: "add-testExam",
            tokenData: req.decoded
          };
        const token = req.accessToken;
        let resourceResult = [];
        let testExamResource = null;
        console.log("req body: ", req.body)
        for (let testExamData of req.body) {
                const previousTestExamCheck = await fetchResource("ActivityDefinition", {identifier: testExamData.code, topic: "43782000"}, token);
                if(previousTestExamCheck.entry && previousTestExamCheck.entry.length > 0)  {
                    return res.status(400).json({ status: 0, message: "TestExam with given code already exists." })
                }              
                testExamResource = buildFHIRResource(ActivityDefinition, testExamData)
           
            console.log("TestExamId: ", testExamResource);     
            let TestExamBundle = await bundleStructure.setBundlePost(testExamResource, testExamResource.identifier, testExamData.uuid, "POST", "identifier");
            console.info("TestExam bundle: ", TestExamBundle)                           
            resourceResult.push(TestExamBundle);   
        }
        let bundleData = await bundleStructure.getBundleJSON({resourceResult});
        // return res.status(201).json({ status: 1, message: "TestExam data saved.", data: bundleData.bundle })  
        console.info("main bundle transaction resource: ", bundleData)
        let response = await axios.post(config.baseUrl, bundleData.bundle, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/fhir+json'
            }
        }); 
        console.log("get bundle json response: ", response)  
        if (response.status == 200 || response.status == 201) {
            let resourceResponse = setTestExamSaveResponse(bundleData.bundle.entry, response.data.entry, "post");
            let responseData = [...resourceResponse, ...bundleData.errData];
            return res.status(201).json({ status: 1, message: "TestExam data saved.", data: responseData })
        }
        else {
            return handleError(res, response)
        }
    }
    catch (error) {
        console.error("saveTestExamData Error: ", error);
        error.code && error.code == "ERR" ? handleError(res, error, error.statusCode, error.message ) :  handleError(res, error)

    }

}

//  save TestExam data
let updateTestExamData = async function (req, res) {    
    try {
        // const validatedBody = validateRequest(req.body, TestExamSaveSchema, res);
        // if (!validatedBody) return;
        let resourceResult = [];
        let testExamResource = null;
        req.queueMeta = {
            data: req.data,
            entity: "examinationMaster",
            requestType: "put",
            apiName: "update-testExam",
            tokenData: req.decoded
          };
        const token = req.accessToken;
        console.log("req body: ", req.body)
        for (let testExamData of req.body) {
            const previousTestExamCheck = await fetchResource("ActivityDefinition", {identifier: testExamData.code, topic: "43782000"}, token);
                if(previousTestExamCheck.entry && previousTestExamCheck.entry.length > 1)  {
                    return res.status(400).json({ status: 0, message: "TestExam with given code already exists." })
                }  
              
                testExamResource = buildFHIRResource(ActivityDefinition, testExamData);
                testExamResource.id = testExamData.fhirId
            console.log("TestExamId: ", testExamResource);     
            let TestExamBundle = await bundleStructure.setBundlePut(testExamResource, null, testExamData.fhirId, "PUT", "identifier");
            console.info("TestExam bundle: ", TestExamBundle)                           
            resourceResult.push(TestExamBundle);   
        }
        let bundleData = await bundleStructure.getBundleJSON({resourceResult});
        // return res.status(201).json({ status: 1, message: "TestExam data saved.", data: bundleData.bundle })  
        console.info("main bundle transaction resource: ", bundleData)
        let response = await axios.post(config.baseUrl, bundleData.bundle, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/fhir+json'
            }
        }); 
        console.log("get bundle json response: ", response)  
        if (response.status == 200 || response.status == 201) {
            let resourceResponse = setTestExamSaveResponse(bundleData.bundle.entry, response.data.entry, "post");
            let responseData = [...resourceResponse, ...bundleData.errData];
            responseData[0].id = null;
            return res.status(201).json({ status: 1, message: "TestExam data saved.", data: responseData })
        }
        else {
            return handleError(res, response)
        }
    }
    catch (error) {
        console.error("saveTestExamData Error: ", error);
        error.code && error.code == "ERR" ? handleError(res, error, error.statusCode, error.message ) :  handleError(res, error)

    }

}

const setTestExamSaveResponse  = (reqBundleData, responseBundleData, type) => {
    let filteredData = [];
    let response = [];
    const responseData = bundleStructure.mapBundleService(reqBundleData, responseBundleData)
    filteredData = responseData.filter(e => (e.resource.resourceType == "ActivityDefinition")|| (type == "patch" && e.resource.resourceType == "Binary"));
    response = responseService.setDefaultResponse("ActivityDefinition", type, filteredData);
    return response;
}

let getTestExamData = async function (req, res) {
    try {
        const link = config.baseUrl + "ActivityDefinition"
        const queryParams = req.query;
        queryParams.topic = "43782000"
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
        console.error("getTestExamData Error",error)
        return handleError(res, error);       
    }
}

const patchTestExamData = async function(req, res) {
    try {
        // const validatedBody = validateRequest(req.body, TestExamPatchSchema, res);
        // if (!validatedBody) return;
        req.queueMeta = {
            data: req.data,
            entity: "examinationMaster",
            requestType: "put",
            apiName: "update-status",
            tokenData: req.decoded
          };
        const resourceType = "ActivityDefinition";
        const reqInput = req.body;
        const token = req.accessToken;
        let resourceResult = [];
      for (let inputData of reqInput) {
        const resourceSavedResult = await fetchResource(resourceType, {_id: inputData.fhirId }, token)
        const resourceSavedData = resourceSavedResult.entry || [];
        if (resourceSavedData.length != 1) {
            const statusCode = 500
            return handleError(res, "TestExam Id " + inputData.fhirId + " does not exist.", statusCode, "TestExam Id " + inputData.fhirId + " does not exist.")
        }        
        const TestExamPatchResource = patchFHIRResource(ActivityDefinition, inputData, resourceSavedData[0].resource)
        console.log("TestExamPatchResource: ", TestExamPatchResource)
        let resourceData = [...TestExamPatchResource];
        let patchResource = await bundleStructure.setBundlePatch(resourceData,resourceType + "/"+inputData.fhirId);        
        resourceResult.push(patchResource);
       
      }
    const bundleData = await bundleStructure.getBundleJSON({resourceResult: resourceResult, errData: []})  
    console.info(bundleData)
    // return res.status(201).json({ status: 1, message: "TestExam name updated.", data: bundleData.bundle })  
    const response = await axios.post(config.baseUrl, bundleData.bundle, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/fhir+json'
        }
    }); 
    console.log("get bundle json response: ", response.status)  
    if (response.status == 200 || response.status == 201) {
        let resourceResponse = setTestExamSaveResponse(bundleData.bundle.entry, response.data.entry, "patch");
        const responseData = [...resourceResponse, ...bundleData.errData];
        res.status(201).json({ status: 1, message: "TestExam status updated.", data: responseData })
    }
    else {
        return handleError(res, response)
    }
    }  catch(error) {
            console.error("patchTestExamData Error",error)
            return handleError(res, error)
    }
}


module.exports = {
    saveTestExamData,
    getTestExamData,
    patchTestExamData,
    updateTestExamData
}