const axios = require("axios")
let {sendInvalidDataError} = require("../utils/responseStatus");
const config = require("../config/nodeConfig");
let { validationResult } = require('express-validator');

const getTransformedResult = (resourceClass, fhirResource) => {
    try {
        const resourceInstance = new resourceClass({}, fhirResource);
        resourceInstance.getFHIRToTransformedResult();
        return resourceInstance.getSimplifiedOutput();
    } catch (error) {
        console.error(`Error createResource :`, error);
        throw error;
    }
}

const buildFHIRResource = (resourceClass, resourceObj) => {
    try {
        const resourceInstance = new resourceClass(resourceObj, {});
        resourceInstance.getJsonToFhirTranslator();
        return resourceInstance.getFHIRResource();
    } catch (error) {
        console.error(`Error createResource :`, error);
        throw error;
    }
}

const postFHIRResource = async (resourceData, endpoint) => {
    try {
        const response = await axios.post(config.baseUrl + endpoint, resourceData);
        return response.data.id || response.data;
    }   catch (error) {
        console.error(`Error creating resource at ${endpoint}:`, error);
        throw error;
    }

}

const buildAndPost = async (resourceClass, resource, endpoint) => {
    try {
        const resourceData = buildFHIRResource(resourceClass, resource)
        console.log(resource, "--------resourceData: ", resourceData)
        const data = postFHIRResource(resourceData, endpoint)
        return data;
    }
    catch(error) {
        console.error(`Error buildAndPost:`, error);
        throw error;
    }
}

const validateRequest = (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      sendInvalidDataError(res, errors.array());
      return { isValid: false };
    }
    return { isValid: true };
  };


const handleError = (res, error, message = "Unable to process. Please try again.") => {
    console.error("Error:", error);
    const errorMessage = error.message || error.toString?.() || "Internal Server Error";
  
    return res.status(500).json({
      status: 0,
      message,
      error: process.env.NODE_ENV === 'production' ? undefined : errorMessage
    });
  };
module.exports = {validateRequest, buildFHIRResource, postFHIRResource, buildAndPost, getTransformedResult, handleError}