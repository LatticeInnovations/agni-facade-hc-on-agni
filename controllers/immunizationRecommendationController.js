let ImmunizationRecommendation = require('../class/ImmunizationRecommendation');
const bundleStructure = require("../services/bundleOperation");
let config = require("../config/nodeConfig");

let setImmunizationRecommendationData = async function (req, res) {
    try {
        const link = config.baseUrl + "ImmunizationRecommendation";
        let queryParams = {
            "_total": "accurate",
            "_count": 10000,
            "patient": req.query.patient
        }
        let resourceResult = []
        let responseData = await bundleStructure.searchData(link, queryParams);
        let resStatus = 1;
        console.info("FHIRData: ", responseData)
        if( !responseData.data.entry || responseData.data.total == 0) {
                return res.status(200).json({ status: resStatus, message: "Data fetched", total: 0, data: []  })
        }
        const FHIRData = responseData.data.entry.map(e => e.resource)
        FHIRData.forEach(recommendationData => {
            let vaccineData = new ImmunizationRecommendation({}, recommendationData);
            vaccineData = vaccineData.getFHIRtoJSON()
            resourceResult.push(...vaccineData);
        })

        
        res.status(200).json({ status: resStatus, message: "Immunization recommendation data fetched.", total: resourceResult.length,"offset": +queryParams?._offset, data: resourceResult  })
        
    }
    catch(e) {
        console.error("Error",e)
        return res.status(200).json({
                status: 0,
                message: "Unable to process. Please try again"
            })
       
    }
}

module.exports = { setImmunizationRecommendationData }