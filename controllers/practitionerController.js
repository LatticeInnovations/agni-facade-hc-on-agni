let Practitioner = require("../class/practitioner");
let axios = require("axios");
let config = require("../config/nodeConfig");
const { v4: uuidv4 } = require('uuid');
const bundleStructure = require("../services/bundleOperation")
const responseService = require("../services/responseService");
const { fetchResource, buildFHIRResource, getTransformedResult } = require("../services/helperFunctions");
const { practitionerSaveArraySchema } = require("../utils/Validator/practitionerValidator");
const {validateRequest} = require("../utils/validateRequest");


//  Save Practitioner data
let savePractitionerData = async function (req, res) {
    try {
        const resType = "Practitioner"
        const validatedBody = validateRequest(req.body, practitionerSaveArraySchema, res);
        if (!validatedBody) return;
        let resourceResult = [];
        for (let practitionerData of req.body) {
            // Check if practitioner    
            let queryParam ={"_total": "accurate"};

            if(practitionerData.mobileNumber) {
                queryParam.phone = practitionerData.mobileNumber;
                let existingPractitionerMobile = await fetchResource("Practitioner", queryParam);
                if (+existingPractitionerMobile.total != 0) {
                    return res.status(422).json( { status: 0, message: "Practitioner data already exists."})
                }
            }
            if(practitionerData.email) {
                let existingPractitionerEmail = await fetchResource("Practitioner", {email: practitionerData.email});
                if (+existingPractitionerEmail.total != 0) {
                     return res.status(422).json( { status: 0, message: "Practitioner data already exists."})
                }
            }
            let practitionerResource = buildFHIRResource(Practitioner, practitionerData);
            practitionerResource.resourceType = resType;
            practitionerResource.id = uuidv4();
            let practitionerBundle = await bundleStructure.setBundlePost(practitionerResource, practitionerResource.telecom, practitionerResource.id, "POST", "telecom"); 
            console.info("Practitioner bundle: ", practitionerBundle) 
            resourceResult.push(practitionerBundle);  
        
       }
        let bundleData = await bundleStructure.getBundleJSON({resourceResult})  
        let response = await axios.post(config.baseUrl, bundleData.bundle); 
        console.info("get bundle json response: ", response.status)  
        if (response.status == 200 || response.status == 201) {
            let responseData = setPractitionerSaveResponse(bundleData.bundle.entry, response.data.entry, "post");        //    
            res.status(201).json({ status: 1, message: "Practitioner data saved.", data: responseData })
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
let getPractitionerData = async function (req, res) {
    try {
        const link = config.baseUrl + "Practitioner"
        let specialOffset = null;
        const queryParams = req.query
        queryParams._total = "accurate";
        let resourceResult = []
        let resourceUrlData = { link: link, reqQuery: queryParams, allowNesting: 1, specialOffset: specialOffset }
        let responseData = await fetchResource("Practitioner", queryParams);
        let resStatus = 1;
        if( !responseData.entry || responseData.total == 0) {
                return res.status(200).json({ status: resStatus, message: "Data fetched", total: 0, data: []  })
        }
        else {            
            resStatus = bundleStructure.setResponse(resourceUrlData, responseData);
            
            for (let i = 0; i < responseData.entry.length; i++) {
                let practitioner = getTransformedResult(Practitioner, responseData.entry[i].resource);
                resourceResult.push(practitioner.getPersonResource())                
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


//  Patch Practitioner data
let patchPractitionerData = async function (req, res) {
    try {
        const resType = "Practitioner"
        // let response = resourceValid(req.params);
        // if (response.error) {
        //     console.error(response.error.details)
        //     let errData = { status: 0, response: { data: response.error.details }, message: "Invalid input" }
        //     return res.status(422).json(errData);
        // }
        let resourceResult = [];
        for (let inputData of req.body) {
            let practitioner = new Practitioner(inputData, []);
            let resourceSavedData = await fetchResource("Practitioner", { "_id": inputData.id })
            if (resourceSavedData.total != 1) {
               return res.status(422).json({ status: 0, code: "ERR", message: "Practitioner Id " + inputData.id + " does not exist."})
            }
            practitioner.patchUserInputToFHIR(resourceSavedData.entry[0].resource);
            let resourceData = [...practitioner.getFHIRResource()];
            const patchUrl = resType + "/" + inputData.id;
            let patchResource = await bundleStructure.setBundlePatch(resourceData, patchUrl);
            resourceResult.push(patchResource);
        }
        let bundleData = await bundleStructure.getBundleJSON({resourceResult})  
        let response = await axios.post(config.baseUrl, bundleData.bundle); 
        console.info("get bundle json response: ", response.status)  
        if (response.status == 200 || response.status == 201) {
            let responseData = setPractitionerSaveResponse(bundleData.bundle.entry, response.data.entry, "patch"); 
            res.status(201).json({ status: 1, message: "Practitioner data saved.", data: responseData })
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



const setPractitionerSaveResponse  = (reqBundleData, responseBundleData, type) => {
    let filteredData = [];
    let response = [];
    const responseData = bundleStructure.mapBundleService(reqBundleData, responseBundleData)
    filteredData = responseData.filter(e => e.resource.resourceType == "Practitioner" || (type == "patch" && e.resource.resourceType == "Binary") );
    response = responseService.setDefaultResponse("Practitioner", type, filteredData)
    console.info("responses: ============================>", filteredData)
    return response;
}


module.exports = {
    savePractitionerData,
    getPractitionerData,
    patchPractitionerData
}