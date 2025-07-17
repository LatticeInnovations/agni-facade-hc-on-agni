let axios = require("axios");
let Slot = require("../class/Slot")
let Encounter = require("../class/BaseEncounter");
let Appointment = require("../class/Appointment");
const bundleStructure = require("../services/bundleOperation");
const responseService = require("../services/responseService");
const { v4: uuidv4 } = require('uuid');
let { appointmentSaveSchema, appointmentPatchSchema } = require("../utils/Validator/scheduleAppointment");
const {validateRequest} = require("../utils/validateRequest")
let apptStatus = require("../utils/appointmentStatus.json");
const {buildFHIRResource, fetchResource, handleError, getTransformedResult} = require("../services/helperFunctions");
let config = require("../config/nodeConfig");




let setAppointmentData = async function (req, res) {
    try {       
        const validatedBody = validateRequest(req.body, appointmentSaveSchema, res);
        if (!validatedBody) return;
        let resourceResult = [];
        resourceResult = await createAppointmentResources(req.body, req.decoded.userId)
        console.info("=============>", resourceResult, "<=========================");
        let bundleData = await bundleStructure.getBundleJSON({resourceResult})  
        console.info("main bundle transaction resource: ", bundleData)
        let response = await axios.post(config.baseUrl, bundleData.bundle); 
        console.log("get bundle json response: ", response)  
        if (response.status == 200 || response.status == 201) {
            let responseData = setAppointmentResponse(bundleData.bundle.entry, response.data.entry, "post");
            res.status(201).json({ status: 1, message: "Appointment data saved.", data: responseData })
        }
        else {
                return handleError(res, response)
        }

    }
    catch (error) {
        console.log("setAppointmentData Error: ", error)
        handleError(res, error)
    }

}

const fetchPractitionerRoleResource = async (userId) => {
    // get PractitionerRole id of the organization sent by app and map it to the appointments
    const roleResource = await fetchResource("PractitionerRole", { practitioner: userId, _total: "accurate" });
    console.log(roleResource.entry[0].resource, userId)
    if (!roleResource.entry)
        throw new Error("PractitionerRole not found for the given organization.");
    return {roleId: roleResource.entry[0].resource.id, orgId: roleResource.entry[0].resource.organization.reference.split("/")[1]};
}

const createAppointmentResources= async function(reqData, userId) {
    try
    {
        const {roleId, orgId} = await fetchPractitionerRoleResource(userId)
        const resourcePromises = reqData.map(async (apptData) => {
            apptData.roleId = roleId;
            // Create Slot resource
            const slotData = { ...apptData.slot, scheduleId: apptData.scheduleId, uuid: uuidv4() };                       
            const slotResource = buildFHIRResource(Slot, slotData, "Slot")
            let slotBundle = await bundleStructure.setBundlePost(slotResource, null, slotData.uuid, "POST", "object");
            console.log("slotResource: ", slotResource)
            // create appointment resource
            apptData.slotUuid = slotData.uuid;
            console.log("Appointment data: ", apptData)
            const apptResource = buildFHIRResource(Appointment, apptData)
            const noneExistDataAppt = [
                { "key": "identifier", "value": `${apptResource.identifier[0].system}|${apptResource.identifier[0].value}`},
                { "key": "actor", "value": `PractitionerRole/${roleId}` },
                { "key": "patient", "value": `Patient/${apptData.patientId}` }
            ]
            let apptBundle = await bundleStructure.setBundlePost(apptResource, noneExistDataAppt, apptData.uuid, "POST", "object"); 

            // Create encounter resource
            apptData.orgId = orgId
            const encounterResource = buildFHIRResource(Encounter, apptData)
            let encounterUuid =  uuidv4();             
            let encounterBundle = await bundleStructure.setBundlePost(encounterResource, encounterResource.identifier, encounterUuid, "POST", "identifier"); 

            return [slotBundle, apptBundle, encounterBundle]
        });

        const resourceResult = ((await Promise.all(resourcePromises)).flat());
        console.log("Appointment Resources: ", resourceResult)
        return resourceResult;
      
        }
    catch (error) {
        console.error("createAppointmentResources Error: ", error)
        throw error;
    }
}

const mapAppointments = (FHIRData) => {
    const roleIds = new Set();
    const apptIds = new Set();
    const slotIds = new Set();
    const apptResult = [];

    for (let apptData of FHIRData) {
        let apptResponse = getTransformedResult(Appointment, apptData.resource)
        console.info(apptResponse)
        
        apptIds.add(apptResponse.appointmentId);
        roleIds.add(apptResponse.roleId);

        let slotId = apptData.resource.slot ? apptData.resource.slot[0].reference.split("/")[1] : null;
        slotIds.add(slotId);
        apptResponse.slotId = slotId;

        apptResult.push(apptResponse);
    }

    return {apptResult, roleIds, apptIds, slotIds}
}

const combineAppointmentData = (apptResult, slotAppt, apptEncounter, apptStatus) =>{

    return apptResult.map(obj1 => {
        const obj2 = slotAppt.find(obj2 => obj2.slotId === obj1.slotId) || {slot: null, slotId: null}
        const obj3 = apptEncounter.find(obj3 => obj3.appointmentId === obj1.appointmentId) || {};
        const statusData = apptStatus.find(e => e.fhirStatus === obj1.apptStatus && e.encounter === obj3.encStatus && e.type === obj1.apptType);
        console.log("appointment status:", obj1.apptStatus, obj3.encStatus, obj1.apptType)

        obj1.status = statusData?.uiStatus || "Unknown";
        obj1.scheduleId = obj2.scheduleId || null

        delete obj1.apptType;
        delete obj1.apptStatus;
        delete obj3.encStatus;

        return { ...obj1, ...obj2, ...obj3 };
    })

}

const getRoleOrgObject = async (roleIds) => {
    console.log("roleIds: ", roleIds)
    const entries = (await fetchResource("PractitionerRole", {
        _id: [...roleIds].join(","),
        _include: "PractitionerRole:organization"
      })).entry || [];
      
      const roleOrgMap = {};
      const orgMap = {};
      
      for (const { resource } of entries) {
        if (resource.resourceType === "PractitionerRole") {
          roleOrgMap[resource.id] = resource;
        } else if (resource.resourceType === "Organization") {
          orgMap[resource.id] = {
            name: resource.name || null,
            code: resource.identifier?.[0]?.value || null
          };
        }
      }
      
      const roleOrg = Object.entries(roleOrgMap).map(([roleId, role]) => {
        const orgId = role.organization?.reference?.split("/")[1] || null;
        const practitionerId = role.practitioner?.reference?.split("/")[1] || null;
        const org = orgMap[orgId] || {};
      
        return {
          roleId,
          practitionerId,
          orgId,
          orgName: org?.name || null,
          orgCode: org?.code || null
        };
      });
      return roleOrg;
    }

const getSlotObject = async (slotIds) => {
    const slotAppt = (await fetchResource("Slot", {
        "_id": [...slotIds].join(","), _count: 5000 
    })).entry.map(e => ({
        slotId: e.resource.id,
        slot: { start: e.resource.start, end: e.resource.end},
        scheduleId: e.resource.schedule.reference.split("/")[1]
    }))
    return slotAppt
}

const getAppointmentEncounterObject = async (apptIds) => {
    const apptEncounterResources = (await fetchResource("Encounter", {
        "appointment": [...apptIds].join(","), _count: 5000
    }));
    console.log("apptEncounterResources: ", apptEncounterResources)
    const apptEncounter = apptEncounterResources.entry.map(e => ({ 
        encStatus: e.resource.status, 
        appointmentId: e.resource.appointment[0].reference.split("/")[1], 
        generatedOn: e?.resource?.period?.start || null } ));
    return apptEncounter;
}

const getAppointment = async function(req, res) {
    try {
            let queryParams = {
                _total : "accurate",
                _count: req.query._count,
                _offset: req.query._offset,
                _sort: req.query._sort
            }

            const FHIRData = await fetchResource("Appointment", queryParams)
            if (!FHIRData.entry) {
                return res.status(200).json({ status: 2, message: "Data fetched", total: 0, data: [] });
            }
            let { apptResult, roleIds, apptIds, slotIds } = mapAppointments(FHIRData.entry);

            const roleOrg = await getRoleOrgObject(roleIds);
            console.log("roleOrg: ", roleOrg)
            //  get organization id from role of appointment
            apptResult = apptResult.map(obj1 => {
                let obj2 = roleOrg.find(obj2 => obj2.roleId === obj1.roleId);
              
                return { ...obj1, ...obj2 };
            });
            const slotAppt = await getSlotObject(slotIds);
            const apptEncounter = await getAppointmentEncounterObject(apptIds)
             //combine appointment with slot and encounter status
             const resourceResult = combineAppointmentData(apptResult, slotAppt, apptEncounter, apptStatus);
            const resStatus = bundleStructure.setResponse({ link: config.baseUrl + "Appointment", reqQuery: queryParams }, FHIRData);
            return res.status(200).json({ status: resStatus, message: "Data fetched", total: resourceResult.length, data: resourceResult  })
        }  
    catch(error) {
        console.error("getAppointment Error: ", error)
        return handleError(res, error)
    }
}

const createEncounterBundle = async (inputData, encounterSavedData, resourceSavedData) => {
    if(inputData.status.value == "in-progress" && encounterSavedData.entry) {
        encounterSavedData.entry[0].resource.status = "in-progress";
        encounterSavedData.entry[0].resource.period = {
            "start": inputData.generatedOn,
            "end": inputData.generatedOn
        }
   }
    // update appointment details 
    else if((inputData.status.value == "completed") && encounterSavedData.entry) {
        encounterSavedData.entry[0].resource.status = "finished";
        inputData.createdOn = {
            "operation": "replace",
            "value": resourceSavedData.entry[0].resource.created
        }
    }
    else {
        return null;
    }
    const encounterBundle = await bundleStructure.setBundlePost(encounterSavedData.entry[0].resource, encounterSavedData.entry[0].resource.identifier, encounterSavedData.entry[0].resource.id, "PUT", "identifier");                   
        
    return {encounterBundle, inputData}
}

const createAppointmentPatchBundle = async (inputData, resourceSavedData, resourceType) => {
    const appointment = new Appointment(inputData, []);
    appointment.setPatchData(resourceSavedData.entry[0].resource);
    let resourceData = [...appointment.getFHIRResource()];
    const patchUrl = resourceType + "/" + inputData.appointmentId;
    const slotId = resourceSavedData.entry[0].resource.slot[0].reference.split("/")[1];
    const appointmentPatchResource = await bundleStructure.setBundlePatch(resourceData, patchUrl);
    const slot = new Slot(inputData, []);
    slot.setPatchData();
    const slotPatchResource = [...slot.getFHIRResource()];
    const slotPatchUrl = "Slot/" + slotId;
    const slotPatch = await bundleStructure.setBundlePatch(slotPatchResource, slotPatchUrl);
    return {appointmentPatchResource, slotPatch}
}

const patchAppointmentData = async function(req, res) {
    try {
      const resourceType = "Appointment";
      const reqInput = req.body;             
      const validatedBody = validateRequest(req.body, appointmentPatchSchema, res);
      if (!validatedBody) return;
      let resourceResult = [], errData = [];        
      for (let inputData of reqInput) {
        let resourceSavedData = await fetchResource(resourceType, { "_id": inputData.appointmentId })
        console.log("resourceSavedData: ", resourceSavedData)
        let encounterSavedData =  await fetchResource("Encounter", { "appointment": inputData.appointmentId })
        if (resourceSavedData.entry.length != 1) {
            return res.status(422).json( { status: 0, message: "Appointment Id " + inputData.appointmentId + " does not exist."})
        }
        else if(resourceSavedData.entry[0].resource.status == "cancelled" || resourceSavedData.entry[0].resource.status == "noshow") {
            // once appointment status is no-show and cancelled it cannot be changed.
            errData.push({
                "status": "422",
                "id": null,
                "err": "Appointment data not changed as status is " + resourceSavedData.entry[0].resource.status,
                "fhirId": inputData.appointmentId
            })
        }
        else {
            const encounterResult = await createEncounterBundle(inputData, encounterSavedData, resourceSavedData);
            if(encounterResult != null) {
                resourceResult.push(encounterResult.encounterBundle)
                inputData = encounterResult.inputData;
            }
            const {appointmentPatchResource, slotPatch} = await createAppointmentPatchBundle(inputData, resourceSavedData, resourceType)
            resourceResult.push(appointmentPatchResource, slotPatch);
        }
    }  
    console.info(resourceResult)
    const resourceData = {resourceResult: resourceResult, errData: []}
    let bundleData = await bundleStructure.getBundleJSON(resourceData)  
    console.info(bundleData)
    let response = await axios.post(config.baseUrl, bundleData.bundle); 
    console.log("get bundle json response: ", response.status)  
    if (response.status == 200 || response.status == 201) {
        let resourceResponse = setAppointmentResponse(bundleData.bundle.entry, response.data.entry, "patch");
        let responseData = [...resourceResponse, ...errData];
        console.info("===========>", responseData)
        return res.status(201).json({ status: 1, message: "Appointment data updated.", data: responseData })
    }
    else {
        console.error("getAppointment Error: ", response)
    }
} catch(e) {
    console.error("patchAppointmentData Error",e)
    return handleError(res, e) 
}
}


const setAppointmentResponse  = (reqBundleData, responseBundleData, type) => {
    let filteredData = [];
    let response = [];
    const responseData = bundleStructure.mapBundleService(reqBundleData, responseBundleData)
    if (["post", "POST", "put", "PUT"].includes(type)){
        filteredData = responseData.filter(e => e.resource.resourceType == "Appointment");
    }
    else if(["patch", "PATCH"].includes(type)){
        filteredData = responseData.filter(e => e.fullUrl.split("/")[0] == "Appointment")
    }

    response = responseService.setDefaultResponse("Appointment", type, filteredData);
    return response;
}

module.exports = { setAppointmentData, getAppointment, patchAppointmentData }