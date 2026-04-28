let AllergyIntolerance = require("../class/AllergyIntolerance")
let axios = require("axios");
let config = require("../config/nodeConfig");
const bundleStructure = require("../services/bundleOperation")
const responseService = require("../services/responseService");
const { fetchResource, buildFHIRResource, getTransformedResult, getAPIPath } = require("../services/helperFunctions");
const { allergySchema } = require("../utils/Validator//allergyValidator");
const {validateRequest} = require("../utils/validateRequest");
const { getPractitionerName } = require("../services/commonFunctions");
const { publishReportJob } = require("../middleware/reportPublisher");
const { saveToken } = require("../services/email/tokenStore");
const MAIN_ENCOUNTER_TYPE = "facility-main-encounter";

const fetchMainEncounters = async function(token, queryParams) {
    try {
        // Check if the facilityId exists
        let allergySchemaEntries = [];
        let nextUrl = null;

        const firstPage = await fetchResource("Encounter", queryParams, token);

         allEntries = [...firstPage.entry];

         if (firstPage.total == 0 || !firstPage.entry) return [];

        const mainEncounters = await fetchResource("Encounter", queryParams, token);

        if(mainEncounters.total == 0 || !mainEncounters.entry) 
            return [];
        return mainEncounters;
    }
    catch(error) {
        console.error("Dashbaord Error: ", error);
        return Promise.reject(error)
    }
}

let getFacilityDashboard = async function (req, res) {
    try {
        const token = req.accessToken;
        
        const queryParams = req.query;
        const mainEncounterQuery = {
            type: MAIN_ENCOUNTER_TYPE,
            "service-provider": queryParams.facilityIds,
            "appointment.slot.start:0": `ge${queryParams.startDate}`,
            "appointment.slot.start:1": `le${queryParams.endDate}`,
            "_total": "accurate",
            "_count": 2
        };
        console.log("main encounter query", mainEncounterQuery)
        const mainEncounter = await fetchMainEncounters(token, mainEncounterQuery);
        console.log("main Encounter; ", mainEncounter);
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


let getDivisionDashboard = async function (req, res) {
    try {


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


module.exports = {
    getFacilityDashboard, getDivisionDashboard
}