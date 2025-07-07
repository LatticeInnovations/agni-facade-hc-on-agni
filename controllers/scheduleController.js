let axios = require("axios");
let Schedule = require("../class/Schedule");
const bundleStructure = require("../services/bundleOperation");
const responseService = require("../services/responseService");
let config = require("../config/nodeConfig");
let {scheduleSaveSchema} = require("../utils/Validator/scheduleAppointment");
const {validateRequest} = require("../utils/validateRequest");
const {buildFHIRResource, fetchResource, handleError, getTransformedResult} = require("../services/helperFunctions");

let setScheduleData = async function (req, res) {
    try {
        const validatedBody = validateRequest(req.body, scheduleSaveSchema, res);
        if (!validatedBody) return;
        let resourceResult = [], errData = [];
        for (let scheduleData of req.body) {
            let locationResource = await fetchResource("Location", { organization: "Organization/" + scheduleData.orgId, _elements: "id", _total: "accurate" });
            console.log("locationResource: ", locationResource)
            let locationId = locationResource.entry[0].resource.id;
            scheduleData.locationId = locationId;
            const scheduleResource = buildFHIRResource(Schedule, scheduleData);
            let noneExistData = [
                    { "key": "date", "value": "ge" + scheduleData.planningHorizon.start },
                    { "key": "date", "value": "le" + scheduleData.planningHorizon.end },
                    { "key": "actor", "value": 'Location/' + locationId }
            ];
            let scheduleBundle = await bundleStructure.setBundlePost(scheduleResource, noneExistData, scheduleData.uuid, "POST", "object");
            resourceResult.push(scheduleBundle);
        }
        console.info("=============>", resourceResult, errData, "<=========================");
        let bundleData = await bundleStructure.getBundleJSON({resourceResult})  
        console.info("main bundle transaction resource: ", bundleData)
        let response = await axios.post(config.baseUrl, bundleData.bundle); 
        console.log("get bundle json response: ", response.status)  
        if (response.status == 200 || response.status == 201) {
            let responseData = setScheduleResponse(bundleData.bundle.entry, response.data.entry, "post");
            res.status(201).json({ status: 1, message: "Schedule data saved.", data: responseData })
        }
        else {
           return handleError(res, response)
        }        
    }
    catch (error) {
        console.error("setScheduleData Error: ", error)
        return handleError(res, error)
    }

}

const mapScheduleData = (FHIRData) => {
    try {
        const locationIds = new Set();
        const scheduleIds = new Set(); 
        const scheduleResult = [];
        for (let scheduleData of FHIRData) {
            const scheduleResponse = getTransformedResult(Schedule, scheduleData.resource);
            scheduleIds.add(scheduleResponse.scheduleId);
            let locationId = scheduleData.resource.actor[0].reference.split("/")[1];
            locationIds.add(locationId);
            scheduleResponse.locationId = locationId;
            scheduleResponse.bookedSlots = 0;
            scheduleResult.push(scheduleResponse);
        }
        return  {scheduleResult, locationIds, scheduleIds}
    }
    catch(error) {
        console.error("mapScheduleData Error: ", error);
        throw error;
    }


}

const joinLocationData = async (scheduleResult, locationIds) => {
    try {
            const orgResource = await fetchResource("Location", { 
                _elements: "managingOrganization", 
                _id: [...locationIds].join(","), _count: locationIds.size });

            const locationOrg = orgResource.entry.map(e => ({
                locationId: e.resource.id,
                orgId: e.resource.managingOrganization.reference.split("/")[1]
            }))
        
            return scheduleResult.map(obj1 => {
                const obj2 = locationOrg.find(obj2 => obj2.locationId === obj1.locationId);
                return { ...obj1, ...obj2 };
            });
    }
    catch(error) {
        console.error("joinLocationData Error: ", error);
        throw error;
    }
}

const countBookedSlots = async (scheduleIds) => {
    const slotList = await fetchResource("Slot", {
        _elements: "schedule",
        "_has:Appointment:slot:slot.schedule": [...scheduleIds].join(","),
        _count: 5000,
        "_has:Appointment:slot:status": "proposed,arrived,noshow"
    });

    const resData = slotList.entry.reduce((acc, { resource }) => {
        const scheduleId = resource.schedule.reference.split("/")[1];
        if (scheduleIds.has(scheduleId)) {
            acc[scheduleId] = (acc[scheduleId] || 0) + 1;
        }
        return acc;
    }, {});

    return Object.entries(resData).map(([scheduleId, bookedSlots]) => ({ scheduleId, bookedSlots }));
};

const getScheduleData = async function(req, res) {
    try {
            let queryParams = {
                _total : "accurate",
                "actor.organization": req.query.orgId,
                _count: req.query._count,
                _offset: req.query._offset,
                _sort: req.query._sort
            };
            let resStatus = 1;
            const resourceType = "Schedule";
            const resourceUrlData = { link: config.baseUrl + resourceType, reqQuery: queryParams, allowNesting: 1, specialOffset: 1 }
            let responseData = await fetchResource(resourceType, queryParams);
            console.log(responseData)
            if( !responseData.entry) {
                return res.status(200).json({ status: resStatus, message: "Data fetched", total: 0, data: []  })
            }
            const { scheduleResult, locationIds, scheduleIds } = mapScheduleData(responseData.entry);
            // to get organization id from location of the schedule and join it with schedule data
            const resourceSlotResult = await joinLocationData(scheduleResult, locationIds);
            // booked slots count
            const bookedSlots = await countBookedSlots(scheduleIds);

            const resourceResult = resourceSlotResult.map(obj1 => {
                const obj2 = bookedSlots.find(obj2 => obj2.scheduleId === obj1.scheduleId);
                return { ...obj1, ...obj2 };
            });

            resStatus = bundleStructure.setResponse(resourceUrlData, responseData);
            return res.status(200).json({ status: resStatus, message: "Data fetched", total: resourceResult.length, data: resourceResult  })
        }  
    catch(error) {
        console.error("Error: ", error)
        return handleError(res, error)
    }
}



const setScheduleResponse  = (reqBundleData, responseBundleData, type) => {
    let filteredData = [];
    let response = [];
    const responseData = bundleStructure.mapBundleService(reqBundleData, responseBundleData)
    filteredData = responseData.filter(e => e.resource.resourceType == "Schedule" || (type == "patch" && e.resource.resourceType == "Binary"));
    response = responseService.setDefaultResponse("Schedule", "post", filteredData);
    return response;
}

module.exports = { setScheduleData, getScheduleData }