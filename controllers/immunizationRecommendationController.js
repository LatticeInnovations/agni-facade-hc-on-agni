let ImmunizationRecommendation = require('../class/ImmunizationRecommendation');
const { getTransformedResult, fetchResource, handleError } = require('../services/helperFunctions');

let setImmunizationRecommendationData = async function (req, res) {
    try {
        let resourceResult = [];
        const token = req.accessToken;
        const queryParams = {
            "_total": "accurate",
            "_count": 10000,
            "patient": req.query.patient
        }
        const responseData = await fetchResource("ImmunizationRecommendation", queryParams, token);
        console.log(responseData)
        let resStatus = 1;
        if( !responseData.entry || responseData.total == 0) {
                return res.status(200).json({ status: resStatus, message: "Data fetched", total: 0, data: []  })
        }
        const FHIRData = responseData.entry.map(e => e.resource);
        FHIRData.forEach(recommendationData => {
            const vaccineData = getTransformedResult(ImmunizationRecommendation, recommendationData);
            console.log("vaccineData; ", vaccineData)
            resourceResult.push(...vaccineData.result);
        })        
        return res.status(200).json({ status: resStatus, message: "Immunization recommendation data fetched.", total: resourceResult.length,"offset": +queryParams?._offset, data: resourceResult  })
        
    }
    catch(e) {
        console.error("Error",e)
        return handleError(res, e);       
    }
}

module.exports = { setImmunizationRecommendationData }