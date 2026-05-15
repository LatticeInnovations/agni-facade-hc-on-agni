let Location = require("../class/LevelLocation");
let Organization = require("../class/HealthFacilityOrganization")
const {buildFHIRResource, fetchResource, handleError, getTransformedResult, patchFHIRResource} = require("../services/helperFunctions");
let axios = require("axios");
let config = require("../config/nodeConfig");
const bundleStructure = require("../services/bundleOperation")
const responseService = require("../services/responseService");
let {levelSaveSchema} = require("../utils/Validator/levelValidator");
const {validateRequest} = require("../utils/validateRequest");
const urlList = require("../utils/heartcareSystemUrl");

//  save Level data
let saveLevelData = async function (req, res) {    
    try {
        const validatedBody = validateRequest(req.body, levelSaveSchema, res);
        if (!validatedBody) return;
        req.queueMeta = {
            data: req.data,
            entity: "level",
            requestType: "post",
            apiName: "add-level",
            tokenData: req.decoded
          };
        const token = req.accessToken;
        let resourceResult = [];
        let levelResource = null;
        for (let levelData of req.body) {
            if(levelData.levelType == "village") {
                const islandData = await fetchResource("Organization", {_id: levelData.precedingLevelId, type: "health-facility", _count: 5000}, token);                
                const locationData = islandData.entry[0].resource.extension.find(e => e.url == urlList.locationReferenceUrl)
                levelData.orgId = levelData.precedingLevelId;
                levelData.precedingLevelId = locationData?.valueReference?.reference?.split("/")[1] || null
            }
            if(levelData.levelType != "health-facility") {
                
                levelResource = buildFHIRResource(Location, levelData)
            }
            else {
                levelResource = buildFHIRResource(Organization, levelData)
            }
                
            let levelBundle = await bundleStructure.setBundlePost(levelResource, null, levelData.uuid, "POST", "identifier");
            console.info("Level bundle: ", levelBundle)                           
            resourceResult.push(levelBundle);   
        }
        let bundleData = await bundleStructure.getBundleJSON({resourceResult});
        // return res.status(201).json({ status: 1, message: "Level data saved.", data: bundleData.bundle })  
        console.info("main bundle transaction resource: ", bundleData)
        let response = await axios.post(config.baseUrl, bundleData.bundle, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/fhir+json'
            }
        });   
        if (response.status == 200 || response.status == 201) {
            let resourceResponse = setLevelSaveResponse(bundleData.bundle.entry, response.data.entry, "post");
            let responseData = [...resourceResponse, ...bundleData.errData];
            return res.status(201).json({ status: 1, message: "Level data saved.", data: responseData })
        }
        else {
            return handleError(res, response)
        }
    }
    catch (error) {
        console.error("saveLevelData Error: ", error);
        error.code && error.code == "ERR" ? handleError(res, error, error.statusCode, error.message ) :  handleError(res, error)

    }

}

//  save Level data
let updateLevelData = async function (req, res) {    
    try {
        // const validatedBody = validateRequest(req.body, levelSaveSchema, res);
        // if (!validatedBody) return;
        let resourceResult = [];
        let levelResource = null;
        req.queueMeta = {
            data: req.data,
            entity: "level",
            requestType: "put",
            apiName: "update-level",
            tokenData: req.decoded
          };
        const token = req.accessToken;
        for (let levelData of req.body) {
            if(levelData.levelType == "village") {
                const islandData = await fetchResource("Organization", {_id: levelData.precedingLevelId, type: "health-facility", _count: 5000}, token);                
                const locationData = islandData.entry[0].resource.extension.find(e => e.url == urlList.locationReferenceUrl)
                levelData.orgId = levelData.precedingLevelId;
                levelData.precedingLevelId = locationData?.valueReference?.reference?.split("/")[1] || null;
            }
            if(levelData.levelType != "health-facility") {
                
                levelResource = buildFHIRResource(Location, levelData);
            }
            else {
                levelResource = buildFHIRResource(Organization, levelData);                
            }
            levelResource.id = levelData.fhirId    
            let levelBundle = await bundleStructure.setBundlePut(levelResource, null, levelData.fhirId, "PUT", "identifier");
            console.info("Level bundle: ", levelBundle)                           
            resourceResult.push(levelBundle);   
        }
        let bundleData = await bundleStructure.getBundleJSON({resourceResult});
        // return res.status(201).json({ status: 1, message: "Level data saved.", data: bundleData.bundle })  
        console.info("main bundle transaction resource: ", bundleData)
        let response = await axios.post(config.baseUrl, bundleData.bundle, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/fhir+json'
            }
        }); 
        if (response.status == 200 || response.status == 201) {
            let resourceResponse = setLevelSaveResponse(bundleData.bundle.entry, response.data.entry, "post");
            let responseData = [...resourceResponse, ...bundleData.errData];
            return res.status(201).json({ status: 1, message: "Level data saved.", data: responseData })
        }
        else {
            return handleError(res, response)
        }
    }
    catch (error) {
        console.error("saveLevelData Error: ", error);
        error.code && error.code == "ERR" ? handleError(res, error, error.statusCode, error.message ) :  handleError(res, error)

    }

}

const setLevelSaveResponse  = (reqBundleData, responseBundleData, type) => {
    let filteredData = [];
    let response = [];
    const responseData = bundleStructure.mapBundleService(reqBundleData, responseBundleData)
    filteredData = responseData.filter(e => (e.resource.resourceType == "Location" || e.resource.resourceType == "Organization" )|| (type == "patch" && e.resource.resourceType == "Binary"));
    response = responseService.setDefaultResponse("Location", type, filteredData);
    return response;
}

let getLevelData = async function (req, res) {
    try {
        const link = config.baseUrl + "Location"
        const queryParams = req.query;
        let resStatus = 1;
        const token = req.accessToken;
        queryParams._total = "accurate"
        queryParams._sort = queryParams._sort || "-_id";
        let resourceResult = [];
        const responseResult = await fetchResource("Location", queryParams, token);
        const responseData = responseResult.entry || []
        if( !responseData) {
            return res.status(200).json({ status: resStatus, message: "Data fetched", total: 0, data: []  })
        }
        else {            
            resStatus = bundleStructure.setResponse({ link: link, reqQuery: queryParams, allowNesting: 1, specialOffset: 1 }, responseResult);            
            for (let i = 0; i < responseData.length; i++) {
                const location = getTransformedResult(Location, responseData[i].resource);
                resourceResult.push(location)                
            }
        }
        return res.status(200).json({ status: resStatus, message: "Data fetched.", total: resourceResult.length,"offset": +queryParams?._offset, data: resourceResult  })
       
    }
    catch(error) {
        console.error("getLevelData Error",error)
        return handleError(res, error);       
    }
}

const patchLevelData = async function(req, res) {
    try {
        // const validatedBody = validateRequest(req.body, levelPatchSchema, res);
        // if (!validatedBody) return;
        const resourceType = "Location";
        const reqInput = req.body;
        const token = req.accessToken;
        let resourceResult = [];
      for (let inputData of reqInput) {
        const resourceSavedResult = await fetchResource(resourceType, {_id: inputData.fhirId }, token)
        const resourceSavedData = resourceSavedResult.entry || [];
        if (resourceSavedData.length != 1) {
            const statusCode = 500
            return handleError(res, "Level Id " + inputData.fhirId + " does not exist.", statusCode, "Level Id " + inputData.fhirId + " does not exist.")
        }        
        const levelPatchResource = patchFHIRResource(Location, inputData, resourceSavedData[0].resource)
        let resourceData = [...levelPatchResource];
        let patchResource = await bundleStructure.setBundlePatch(resourceData,resourceType + "/"+inputData.fhirId);        
        resourceResult.push(patchResource);
       
      }
    const bundleData = await bundleStructure.getBundleJSON({resourceResult: resourceResult, errData: []})  
    console.info(bundleData)
    // return res.status(201).json({ status: 1, message: "Level name updated.", data: bundleData.bundle })  
    const response = await axios.post(config.baseUrl, bundleData.bundle, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/fhir+json'
        }
    }); 
    console.log("get bundle json response: ", response.status)  
    if (response.status == 200 || response.status == 201) {
        let resourceResponse = setLevelSaveResponse(bundleData.bundle.entry, response.data.entry, "patch");
        const responseData = [...resourceResponse, ...bundleData.errData];
        res.status(201).json({ status: 1, message: "Level name updated.", data: responseData })
    }
    else {
        return handleError(res, response)
    }
    }  catch(error) {
            console.error("patchlevelData Error",error)
            return handleError(res, error)
    }
}


module.exports = {
    saveLevelData,
    getLevelData,
    patchLevelData,
    updateLevelData
}