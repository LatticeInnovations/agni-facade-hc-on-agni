let Organization = require("../class/Organization");
let Location = require("../class/location");
let config = require("../config/nodeConfig");
const bundleStructure = require("../services/bundleOperation")



//  Get Organization data
let getOrganizationData = async function (req, res) {
    try {
        const link = config.baseUrl + "Organization"
        let specialOffset = null;
        let queryParams = req.query
        queryParams.type = "prov";
        queryParams["_revinclude"] = "Location:organization:Organization";
        queryParams["_total"] = "accurate";
        let resourceResult = []
        let resourceUrlData = { link: link, reqQuery: queryParams, allowNesting: 1, specialOffset: specialOffset }
        let responseData = await bundleStructure.searchData(link, queryParams);
        let resStatus = 1;
        if( !responseData.data.entry || responseData.data.total == 0) {
                return res.status(200).json({ status: resStatus, message: "Data fetched", total: 0, data: []  })
        }
        else {            
            resStatus = bundleStructure.setResponse(resourceUrlData, responseData);
            
            let orgList = responseData.data.entry.filter(e => e.resource.resourceType == "Organization").map(e => e.resource);
            for (let orgData of orgList) { 
                let locationResource = responseData.data.entry.filter(e => e.resource.resourceType == "Location" && e.resource.managingOrganization.reference == "Organization/" + orgData.id).map(e => e.resource)[0];
                let organization = new Organization({}, orgData );
                organization.getFHIRToTransformedResult();
                let organizationData = organization.getOrgResource();
                let location = new Location({}, locationResource);
                location.getFhirToJson();
                let locationData = location.getLocationResource();
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