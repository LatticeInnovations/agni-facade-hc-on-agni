const axios = require("axios")
let {sendInvalidDataError} = require("../utils/responseStatus");
const config = require("../config/nodeConfig");
let { validationResult } = require('express-validator');
const bundleStructure = require("../services/bundleOperation");

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
        const { optionalParam, ...rest } = resourceObj;
        const resourceInstance = new resourceClass(rest, {}, optionalParam);
        resourceInstance.getJsonToFhirTranslator();
        return resourceInstance.getFHIRResource();
    } catch (error) {
        console.error(`Error createResource :`, error);
        throw error;
    }
}

const patchFHIRResource = (resourceClass, resourceObj, fetchedResourceData) => {
    try {
        const resourceInstance = new resourceClass(resourceObj, []);
        resourceInstance.setPatchData(fetchedResourceData);
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


const handleError = (res, error, statusCode=500, message = "Unable to process. Please try again.", ) => {
    console.error("Error:", error);
    const errorMessage = error.message || error.toString?.() || "Internal Server Error";
  
    return res.status(statusCode).json({
      status: 0,
      message,
      error: process.env.NODE_ENV === 'production' ? undefined : errorMessage
    });
  };


const fetchResource = async (resourceType, queryParams) => {
    try {
        const response = await bundleStructure.searchData(config.baseUrl + resourceType, queryParams);
        return response.data || {}
    } catch (error) {
        console.error(`Error fetching ${resourceType}:`, error);
        throw error;
    }
}

module.exports = {validateRequest, buildFHIRResource, postFHIRResource, buildAndPost, getTransformedResult, handleError, fetchResource, patchFHIRResource}