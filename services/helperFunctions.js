const axios = require("axios")
let {sendInvalidDataError} = require("../utils/responseStatus");
const config = require("../config/nodeConfig");
let { validationResult } = require('express-validator');
const bundleStructure = require("../services/bundleOperation");
const {runWithLimit} = require("../utils/limiter");
const http = require("http");
const {URL} = require("url")
const schemaList = config.schemaList;
const domainsList = config.domainsList;

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


const postFHIRResource = async (resourceData, endpoint, token) => {
    try {
        const response = await axios.post(config.baseUrl + endpoint, resourceData, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/fhir+json'
            }
        });
        return response.data.id || response.data;
    }   catch (error) {
        console.error(`Error creating resource at ${endpoint}:`, error);
        throw error;
    }

}

const buildAndPost = async (resourceClass, resource, endpoint) => {
    try {
        const resourceData = buildFHIRResource(resourceClass, resource);
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



const fetchResource = async (resourceType, queryParams, token) => {
    try {
        if (!token || typeof token !== 'string' || token.trim() === '') {
            return Promise.reject({
                status: 0,
                code: "UNAUTHORIZED",
                e: "Missing or invalid authorization token",
                statusCode: 401
            });
        }
            const urlVal = (new URL(config.baseUrl + resourceType));
            if (schemaList.includes(urlVal.protocol) && domainsList.includes(urlVal.hostname)) {
                try {
                    const headers = {
                        'Accept': 'application/fhir+json',
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                    // const responseData = await runWithLimit(() =>
                    //     axios.get(urlVal.toString(), { params: queryParams, headers })
                    //   );
                    let responseData = await axios.get(urlVal, { params: queryParams, headers: headers });
                    return responseData.data || {};
                } catch (e) {
                    let eData = { status: 0, code: "ERR", e: e, statusCode: 500 }
                    return Promise.reject(eData);
                }
            }
            else {
                let error = { status: 0, code: "ERR", e: "INVALID_URL", statusCode: 500 }
                return Promise.reject(error)
            }
    } catch (error) {
        console.error(`Error fetching ${resourceType}:`, error);
        throw error;
    }
}

const getAPIPath = async (req) => {
    console.log("checking req path: ", req.path, req.originalUrl, req.baseUrl)
    if(req.baseUrl.includes("/campaign/"))
        return true;
    return false;
}

const getCampaignPractitionerRole = async (practitionerId, campaignId, token) => {
    try {
        const practitionerRoleResource = await fetchResource("PractitionerRole", {practitioner: practitionerId, location: campaignId, _total: "accurate"}, token)
        if(practitionerRoleResource.total > 0) {
            return practitionerRoleResource.entry[0].resource.id
        }
        return null;
    } catch (error) {
        console.error(`Error fetching ${resourceType}:`, error);
        throw error;
    }

}

const fetchMainResourcesParallel = async function(resourceName, queryParams, token) {
    try {
        const firstPage = await fetchResource(resourceName, queryParams, token);
        const total = firstPage.total || 0;
        const count = queryParams._count || 100;
        const totalPages = Math.ceil(total / count);
        if (totalPages <= 1) return { ...firstPage };
        const pagePromises = Array.from({ length: totalPages - 1 }, (_, i) =>
            fetchResource(resourceName, { ...queryParams, _page: i + 2 }, token)
        );
        const remainingPages = await Promise.all(pagePromises);
        const allEntries = [
            ...(firstPage.entry || []),
            ...remainingPages.flatMap(page => page.entry || [])
        ];
        return { ...firstPage, entry: allEntries, total };
    }
    catch(error) {
        console.error("fetchMainResourcesParallel Error: ", error);
        throw error;
    }
}

const getNextPageUrl = function(links = []) {
    const nextLink = links?.find(link => link.relation === "next");
    return nextLink ? nextLink.url : null;
}

const fetchInBatches = async (ids, batchSize, fetchFn ) => {
    const results = [];
    for(let i = 0; i < ids.length; i += batchSize) {
         const batch = ids.slice(i, i + batchSize);
         const result = await fetchFn(batch);
         results.push(result);
    }

    return results;
}

module.exports = {validateRequest, buildFHIRResource, postFHIRResource, buildAndPost, getTransformedResult, handleError, fetchResource, patchFHIRResource, getAPIPath, getCampaignPractitionerRole, fetchMainResourcesParallel, getNextPageUrl, fetchInBatches}