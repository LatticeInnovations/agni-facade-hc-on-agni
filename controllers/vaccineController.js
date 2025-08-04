const { fetchResource } = require("../services/helperFunctions");
let getManufacturer = async function (req, res) {
    try {
        //  Get organizations list which are manufacturers
        const reqQuery = {
            type: "bus",
            _count: 1000
        }
        const token = req.accessToken;
        //  fetch data from fhir server
        let responseData = await fetchResource("Organization", reqQuery, token);
        let manufacturersList = []
        if(responseData.entry.length > 0) {
            manufacturersList = responseData.entry.map(res => {
                return {
                    "manufacturerId": res.resource.id,
                    "manufacturerName": res.resource.name,
                    "active": res.resource.active,
                    "orgType": res.resource.type[0].coding[0].code
                }
            })
        }

        return res.status(200).json({status: 1, message: "Data fetched", total : responseData.total, data: manufacturersList});
        
    }
    catch (e) {
        console.error(e);
        return res.status(500).json({
            status: 0,
            message: "Unable to process. Please try again.",
            err: e
        })
    }

}

module.exports = {getManufacturer}