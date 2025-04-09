let axios = require("axios");
let Schedule = require("../class/Schedule");
const bundleStructure = require("../services/bundleOperation");
const responseService = require("../services/responseService");
let config = require("../config/nodeConfig");
let {validateScheduleArray} = require("../utils/Validator/scheduleAppointment");
const validateRequest = require("../utils/validateRequest");

let setScheduleData = async function (req, res) {
    try {
        let resourceResult = [], errData = [];
        const resType = "Schedule"
        validateRequest(req, res, validateScheduleArray);
        for (let scheduleData of req.body) {
            let locationResource = await bundleStructure.searchData(config.baseUrl + "Location", { organization: "Organization/" + scheduleData.orgId, _elements: "id", _total: "accurate" });
            let locationId = locationResource.data.entry[0].resource.id;
            scheduleData.locationId = locationId;
                console.info("this is a check for data")
                let schedule = new Schedule(scheduleData, {});
                schedule.getJsonToFhirTranslator();
                let scheduleResource = {};
                scheduleResource = { ...schedule.getResource() };
                scheduleResource.resourceType = resType;
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
            return res.status(500).json({status: 0, message: "Unable to process. Please try again.", error: response})
        }
        
    }

    catch (e) {
        return Promise.reject(e);
    }

}

const getScheduleData = async function(req, res) {
    try {
            let queryParams = {
                _total : "accurate",
                _count: req.query._count,
                _offset: req.query._offset,
                _sort: req.query._sort
            }
            queryParams["actor.organization"] = req.query.orgId;
            const link = config.baseUrl + "Schedule";
            let resourceResult = [];
            let resourceUrlData = { link: link, reqQuery: queryParams, allowNesting: 1, specialOffset: 1 }
            let responseData = await bundleStructure.searchData(link, queryParams);
            console.info("responseData: ", responseData)
            let resStatus = 1;
            if( !responseData.data.entry || responseData.data.total == 0) {
                return res.status(200).json({ status: resStatus, message: "Data fetched", total: 0, data: []  })
            }
            const FHIRData = responseData.data.entry;
            let locationIds = new Set(), scheduleIds = new Set(); let scheduleResult = [], resourceSlotResult = [];
            for (let scheduleData of FHIRData) {
                let schedule = new Schedule({}, scheduleData.resource);
                schedule.getFHIRToUserInput();
                let scheduleResponse = schedule.getInput();
                scheduleIds.add(scheduleResponse.scheduleId);
                let locationId = scheduleData.resource.actor[0].reference.split("/")[1];
                locationIds.add(locationId);
                scheduleResponse.locationId = locationId;
                scheduleResponse.bookedSlots = 0;
                scheduleResult.push(scheduleResponse);
            }
            // to get organization id from location of the schedule and join it with schedule data
            let orgResource = await bundleStructure.searchData(config.baseUrl + "Location", { _elements: "managingOrganization", _id: [...locationIds].join(","), _count: locationIds.size });

            let locationOrg = orgResource.data.entry.map(e => { return { locationId: e.resource.id, orgId: e.resource.managingOrganization.reference.split("/")[1] } });
            resourceSlotResult = scheduleResult.map(obj1 => {
                let obj2 = locationOrg.find(obj2 => obj2.locationId === obj1.locationId);
                return { ...obj1, ...obj2 };
            });
            // booked slots count

            let slotList = await bundleStructure.searchData(config.baseUrl + "Slot", { _elements: "schedule", "_has:Appointment:slot:slot.schedule": [...scheduleIds].join(","), _count: 5000, "_has:Appointment:slot:status": "proposed,arrived,noshow" });
            let resData = []; let resourceResult1 = null;
            if (slotList.data.total > 0) {
                resData = slotList.data.entry.reduce((acc, { resource }) => {
                    let scheduleId = resource.schedule.reference.split("/")[1];
                    if (scheduleIds.has(scheduleId))
                        acc[scheduleId] = (acc[scheduleId] || 0) + 1;
                    return acc;
                }, {});
            }
            else {
                slotList.data.entry = []
                for (let i = 0; i < scheduleIds.size; i++) {
                    resData[scheduleIds[i]] = 0
                }
            }

            resourceResult1 = Object.entries(resData).map(([scheduleId, bookedSlots]) => ({ scheduleId, bookedSlots }));
            resourceResult = resourceSlotResult.map(obj1 => {
                let obj2 = resourceResult1.find(obj2 => obj2.scheduleId === obj1.scheduleId);
                return { ...obj1, ...obj2 };
            });
            resStatus = bundleStructure.setResponse(resourceUrlData, responseData);
            res.status(200).json({ status: resStatus, message: "Data fetched", total: resourceResult.length, data: resourceResult  })
        }  
    catch(e) {
        console.error("Error: ", e)
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