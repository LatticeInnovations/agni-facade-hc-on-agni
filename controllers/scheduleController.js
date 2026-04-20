let axios = require("axios");
let Schedule = require("../class/Schedule");
const urlList = require("../utils/heartcareSystemUrl");
const bundleStructure = require("../services/bundleOperation");
const responseService = require("../services/responseService");
let config = require("../config/nodeConfig");
let {scheduleSaveSchema, campaignScheduleValidationSchema} = require("../utils/Validator/scheduleAppointment");
const {validateRequest} = require("../utils/validateRequest");
const {buildFHIRResource, fetchResource, handleError, getTransformedResult, getAPIPath} = require("../services/helperFunctions");

let setScheduleData = async function (req, res) {
    try {
        const isCampaignPath = await getAPIPath(req);
        console.log("check is it campaign path: ", isCampaignPath)

        const validatedBody = validateRequest(req.body, isCampaignPath ? campaignScheduleValidationSchema : scheduleSaveSchema, res);
        if (!validatedBody) return;

        const token = req.accessToken;
        if (!isCampaignPath) applyNonCampaignSideEffects(req);
        let resourceResult = [], errData = [];
        const practitionerRoleResource = await fetchResource("PractitionerRole", { practitioner: req.decoded.userId, _total: "accurate" }, token);
        const roleId = practitionerRoleResource.entry[0].resource.id;
        const orgId = getOrgId(isCampaignPath, practitionerRoleResource);
        console.log("check orgId: ", orgId)
        resourceResult = await Promise.all(
            req.body.map(scheduleData =>
                buildScheduleBundle(scheduleData, roleId, orgId, isCampaignPath)
            )
        );
        // console.info("=============>", resourceResult, errData, "<=========================");
        let bundleData = await bundleStructure.getBundleJSON({resourceResult})  
        let response = await axios.post(config.baseUrl, bundleData.bundle, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/fhir+json'
            }
        });  
        // console.log("response: ", response)
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


function applyNonCampaignSideEffects(req) {
    req.queueMeta = {
        data: req.data,
        entity: "appointments",
        sub_entity: "schedule",
        requestType: "post",
        apiName: "save-schedule",
        tokenData: req.decoded
    };
}

function getOrgId(isCampaignPath, practitionerRoleResource) {
    if (isCampaignPath) return null;
    return practitionerRoleResource.entry[0].resource.organization.reference.split("/")[1];
}

function buildNoneExistData(isCampaignPath, scheduleData, roleId, orgId) {
    return [
        { key: "date", value: encodeURIComponent("ge" + scheduleData.planningHorizon.start) },
        { key: "date", value: encodeURIComponent("le" + scheduleData.planningHorizon.end) },
        isCampaignPath
            ? { key: "actor", value: "Location/" + scheduleData.campaignId }
            : { key: "actor.organization", value: "Organization/" + orgId }
    ];
}

async function buildScheduleBundle(scheduleData, roleId, orgId, isCampaignPath) {
    scheduleData.roleId = roleId;
    scheduleData.serviceType = isCampaignPath ? "screening-site" : "facility";

    const   scheduleResource = buildFHIRResource(Schedule, scheduleData);
    const noneExistData = buildNoneExistData(isCampaignPath, scheduleData, roleId, orgId);

    return bundleStructure.setBundlePost(scheduleResource, noneExistData, scheduleData.uuid, "POST", "object");
}

const mapScheduleData = async (FHIRData, token) => {
    try {
        const roleList = FHIRData.map(e => e.resource.actor[0].reference.split("/")[1]).join(",")
        const orgPractitionerRoleResources = await fetchResource("PractitionerRole", {"_id": roleList, _include: "PractitionerRole:organization"}, token)

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
        const roleId = schedule?.roleId || null;
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


const countBookedSlots = async (scheduleIds, token) => {
    const slotList = await fetchResource("Slot", {
        _elements: "schedule",
        "_has:Appointment:slot:slot.schedule": [...scheduleIds].join(","),
        _count: 5000,
        "_has:Appointment:slot:status": "proposed,arrived,noshow"
    }, token);
    if(slotList.total == 0)
        return []
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
        const isCampaignPath = await getAPIPath(req);
            let queryParams = {
                _total : "accurate",
                _count: req.query._count,
                _offset: req.query._offset,
                _sort: req.query._sort,
                _lastUpdated: req.query._lastUpdated,
                "service-type": isCampaignPath ? "screening-site" : "facility"
            };
            let resStatus = 1;
            const token = req.accessToken;
            const resourceType = "Schedule";
            const resourceUrlData = { link: config.baseUrl + resourceType, reqQuery: queryParams, allowNesting: 1, specialOffset: 1 }
            let responseData = await fetchResource(resourceType, queryParams, token);
            if( !responseData.entry) {
                return res.status(200).json({ status: 2, message: "Data fetched", total: 0, data: []  })
            }
            const { scheduleResult, scheduleIds } = await mapScheduleData(responseData.entry, token);
            // to get organization id from location of the schedule and join it with schedule data
            // const resourceSlotResult = await joinRoleData(scheduleResult, roleIds);
            // booked slots count
            const bookedSlots = await countBookedSlots(scheduleIds, token);

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