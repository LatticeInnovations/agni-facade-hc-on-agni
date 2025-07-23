let axios = require("axios");
let Schedule = require("../class/Schedule");
const urlList = require("../utils/heartcareSystemUrl");
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
        req.queueMeta = {
            data: req.data,
            entity: "appointments",
            sub_entity: "schedule",
            requestType: "post",
            apiName: "save-schedule",
            tokenData: req.decoded
          };
        let resourceResult = [], errData = [];
        const practitionerRoleResource = await fetchResource("PractitionerRole", { practitioner: req.decoded.userId, _elements: "_id,organization", _total: "accurate" });
        console.log("practitionerRoleResource: ", practitionerRoleResource.entry[0].resource)
        const roleId = practitionerRoleResource.entry[0].resource.id
        const orgId = practitionerRoleResource.entry[0].resource.organization.reference.split("/")[1]
        for (let scheduleData of req.body) {
            scheduleData.roleId = roleId;
            const scheduleResource = buildFHIRResource(Schedule, scheduleData);
            let noneExistData = [
                    { "key": "date", "value": encodeURIComponent("ge" + scheduleData.planningHorizon.start) },
                    { "key": "date", "value": encodeURIComponent("le" + scheduleData.planningHorizon.end) },
                    { "key": "actor.organization", "value": 'Organization/' + orgId }
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

const mapScheduleData = async (FHIRData) => {
    try {
        const roleList = FHIRData.map(e => e.resource.actor[0].reference.split("/")[1]).join(",")
        console.log("roleList: ", roleList)
        const orgPractitionerRoleResources = await fetchResource("PractitionerRole", {"_id": roleList, _include: "PractitionerRole:organization"})

        // Create lookup maps
        const roleMap = {};
        const orgMap = {};

        for (const { resource } of orgPractitionerRoleResources.entry || []) {
        if (resource.resourceType === "PractitionerRole") {
            roleMap[resource.id] = resource;
        } else if (resource.resourceType === "Organization") {
            orgMap[resource.id] = resource;
        }
        }
        // Process Schedules
        const roleIds = new Set();
        const scheduleIds = new Set();
        const scheduleResult = FHIRData.map(({ resource }) => {
        const schedule = getTransformedResult(Schedule, resource);
        const roleId = schedule.roleId;
        const role = roleMap[roleId];

        const orgId = roleMap[roleId]?.organization?.reference?.split("/")[1];
        const org = orgMap[orgId];
        
        const practitionerRef = role?.practitioner?.reference;
        const practitionerId = practitionerRef?.split("/")[1] || null;

        roleIds.add(roleId);
        scheduleIds.add(schedule.scheduleId);

        return {
            ...schedule,
            bookedSlots: 0,
            practitionerId,
            hospitalId: org?.identifier?.find(i =>
                i.system === urlList.adminDivisionUrl
            )?.value || null,
            hospitalFhirId: org?.id || null,
            hospitalName: org?.name || null,
            hospitalCode: org?.identifier?.find(i =>
                i.system === urlList.adminDivisionCodeUrl
            )?.value || null
            
        };
        });

return { scheduleResult, scheduleIds };
    }
    catch(error) {
        console.error("mapScheduleData Error: ", error);
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
                // "actor": "PractitionerRole/" + roleId,
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
                return res.status(200).json({ status: 2, message: "Data fetched", total: 0, data: []  })
            }
            const { scheduleResult, scheduleIds } = await mapScheduleData(responseData.entry);
            // to get organization id from location of the schedule and join it with schedule data
            // const resourceSlotResult = await joinRoleData(scheduleResult, roleIds);
            // booked slots count
            const bookedSlots = await countBookedSlots(scheduleIds);

            const resourceResult = scheduleResult.map(obj1 => {
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