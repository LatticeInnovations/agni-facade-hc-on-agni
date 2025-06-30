let Organization = require("../class/Organization");
let Location = require("../class/location");
let config = require("../config/nodeConfig");
const bundleStructure = require("../services/bundleOperation");
const { fetchResource, getTransformedResult } = require("../services/helperFunctions");



//  Get Organization data
let getOrganizationData = async function (req, res) {
    try {
        const link = config.baseUrl + "Organization"
        let specialOffset = null;
        const queryParams = req.query
        queryParams.type = "prov";
        queryParams["_revinclude"] = "Location:organization:Organization";
        queryParams["_total"] = "accurate";
        let resourceResult = []
        let resourceUrlData = { link: link, reqQuery: queryParams, allowNesting: 1, specialOffset: specialOffset }
        let responseData = await fetchResource("Organization", queryParams);
        let resStatus = 1;
        if( !responseData.entry || responseData.total == 0) {
                return res.status(200).json({ status: resStatus, message: "Data fetched", total: 0, data: []  })
        }
        else {            
            resStatus = bundleStructure.setResponse(resourceUrlData, responseData);
            
            let orgList = responseData.entry.filter(e => e.resource.resourceType == "Organization").map(e => e.resource);
            for (const orgResource of orgList) { 
                let locationResource = responseData.entry.filter(e => e.resource.resourceType == "Location" && e.resource.managingOrganization.reference == "Organization/" + orgResource.id).map(e => e.resource)[0];
                const organizationData = getTransformedResult(Organization, orgResource);
                const locationData = getTransformedResult(Location, locationResource);
                organizationData.position = locationData.position;
                console.info(organizationData);
                resourceResult.push(organizationData)
            }
        res.status(200).json({ status: resStatus, message: "Data fetched.", total: resourceResult.length,"offset": +queryParams?._offset, data: resourceResult  })
        
    }}
    catch(e) {
        console.error("Error",e)
        return res.status(200).json({
                status: 0,
                message: "Unable to process. Please try again"
            })
       
    }
}



module.exports = {
    getOrganizationData
}