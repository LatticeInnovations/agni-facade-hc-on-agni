let Medication = require("../class/medication");
let config = require("../config/nodeConfig");
const bundleStructure = require("../services/bundleOperation");
const {fetchResource, getTransformedResult, handleError} = require("../services/helperFunctions");


//  Get Practitioner data
let getMedicationList = async function (req, res) {
    try {
        let queryParams = req.query
        queryParams._total = "accurate";
        const resourceResult = []
        const resourceUrlData = { link: config.baseUrl + "Medication", reqQuery: queryParams, allowNesting: 1, specialOffset: null }
        let responseData = await fetchResource("Medication", queryParams);
        let resStatus = 1;
        if( !responseData.entry || responseData.total == 0) {
                return res.status(200).json({ status: resStatus, message: "Data fetched", total: 0, data: []  })
        }          
        resStatus = bundleStructure.setResponse(resourceUrlData, responseData);
        responseData.entry.forEach(element => {
            const FHIRData = element.resource;
            const medicationData = getTransformedResult(Medication, FHIRData);
            resourceResult.push(medicationData)
        });
        
        res.status(200).json({ status: resStatus, message: "Medicines list fetched.", total: resourceResult.length,"offset": +queryParams?._offset, data: resourceResult  })
        
    }
    catch(error) {
        console.error("saveSymptomDiagnosisData Error: ", error)
        return handleError(res, error)
    }
}



module.exports = {
    getMedicationList
}