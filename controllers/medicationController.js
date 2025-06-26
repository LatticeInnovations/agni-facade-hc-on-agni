let Medication = require("../class/medication");
let config = require("../config/nodeConfig");
const bundleStructure = require("../services/bundleOperation");


//  Get Practitioner data
let getMedicationList = async function (req, res) {
    try {
        const link = config.baseUrl + "Medication"
        let specialOffset = null;
        let queryParams = req.query
        queryParams._total = "accurate";
        let resourceResult = []
        let resourceUrlData = { link: link, reqQuery: queryParams, allowNesting: 1, specialOffset: specialOffset }
        let responseData = await bundleStructure.searchData(link, queryParams);
        let resStatus = 1;
        if( !responseData.data.entry || responseData.data.total == 0) {
                return res.status(200).json({ status: resStatus, message: "Data fetched", total: 0, data: []  })
        }          
        resStatus = bundleStructure.setResponse(resourceUrlData, responseData);
        responseData.data.entry.forEach(element => {
            const FHIRData = element.resource;
            let medication = new Medication({}, FHIRData);
            medication.getFHIRToTransformedResult();
            resourceResult.push(medication.getMedicationResource())
        });
        
        res.status(200).json({ status: resStatus, message: "Medicines list fetched.", total: resourceResult.length,"offset": +queryParams?._offset, data: resourceResult  })
        
    }
    catch(e) {
        console.error("Error",e)
        return res.status(200).json({
                status: 0,
                message: "Unable to process. Please try again"
            })
       
    }
}



module.exports = {
    getMedicationList
}