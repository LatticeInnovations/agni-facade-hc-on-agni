let axios = require("axios");
let Slot = require("../class/Slot")
let Encounter = require("../class/BaseEncounter");
let Appointment = require("../class/Appointment");
const bundleStructure = require("../services/bundleOperation");
const responseService = require("../services/responseService");
const { v4: uuidv4 } = require('uuid');
let appointmentValidation = require("../utils/Validator/scheduleAppointment").validateAppointmentArray;
let {validateAppointmentPatch} = require("../utils/Validator/scheduleAppointment");
const {validateRequest} = require("../utils/validateRequest")
let apptStatus = require("../utils/appointmentStatus.json");
const {buildFHIRResource, fetchResource, handleError, getTransformedResult} = require("../services/helperFunctions");
let config = require("../config/nodeConfig");




let setAppointmentData = async function (req, res) {
    try {
       
        validateRequest(req, res, appointmentValidation);
        let resourceResult = [];
        resourceResult = await createAppointmentResources(req.body)
        console.info("=============>", resourceResult, "<=========================");
        let bundleData = await bundleStructure.getBundleJSON({resourceResult})  
        console.info("main bundle transaction resource: ", bundleData)
        let response = await axios.post(config.baseUrl, bundleData.bundle); 
        console.log("get bundle json response: ", response.status)  
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

const fetchLocationResource = async (orgId) => {
    // get location id of the organization sent by app and map it to the appointments
    const locationResource = await fetchResource("Location", { organization: "Organization/" + orgId, _elements: "id", _total: "accurate" });
    if (!locationResource.entry)
        throw new Error("Location not found for the given organization.");
    return locationResource.entry[0].resource.id;
}

const createAppointmentResources= async function(reqData) {
    try
    {
        const resourcePromises = reqData.map(async (apptData) => {
            const locationId = await fetchLocationResource(apptData.orgId)
            apptData.locationId = locationId;

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
                { "key": "location", "value": `Location/${locationId}` },
                { "key": "patient", "value": `Patient/${apptData.patientId}` }
            ]
            let apptBundle = await bundleStructure.setBundlePost(apptResource, noneExistDataAppt, apptData.uuid, "POST", "object"); 

            // Create encounter resource
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
    const locationIds = new Set();
    const apptIds = new Set();
    const slotIds = new Set();
    const apptResult = [];

    for (let apptData of FHIRData) {
        let apptResponse = getTransformedResult(Appointment, apptData.resource)
        console.info(apptResponse)
        
        apptIds.add(apptResponse.appointmentId);
        locationIds.add(apptResponse.locationId);

        let slotId = apptData.resource.slot ? apptData.resource.slot[0].reference.split("/")[1] : null;
        slotIds.add(slotId);
        apptResponse.slotId = slotId;

        apptResult.push(apptResponse);
    }

    return {apptResult, locationIds, apptIds, slotIds}
}

const combineAppointmentData = (apptResult, locationOrg, slotAppt, apptEncounter, apptStatus) =>{

    return apptResult.map(obj1 => {
        const obj2 = slotAppt.find(obj2 => obj2.slotId === obj1.slotId) || {slot: null, slotId: null}
        const obj3 = apptEncounter.find(obj3 => obj3.appointmentId === obj1.appointmentId) || {};
        const statusData = apptStatus.find(e => e.fhirStatus === obj1.apptStatus && e.encounter === obj3.encStatus && e.type === obj1.apptType);

        obj1.status = statusData?.uiStatus || "Unknown";
        obj1.scheduleId = obj2.scheduleId || null

        delete obj1.apptType;
        delete obj1.apptStatus;
        delete obj3.encStatus;

        return { ...obj1, ...obj2, ...obj3 };
    })

}

const getAppointment = async function(req, res) {
    try {
            let queryParams = {
                _total : "accurate",
                _count: req.query._count,
                _offset: req.query._offset,
                _sort: req.query._sort,
                "location.organization": req.query.orgId
            }

            const FHIRData = await fetchResource("Appointment", queryParams)
            if (!FHIRData.entry.length) {
                return res.status(200).json({ status: 1, message: "Data fetched", total: 0, data: [] });
            }
            let { apptResult, locationIds, apptIds, slotIds } = mapAppointments(FHIRData.entry);

            const locationOrg = (await fetchResource("Location", {
                _elements: "managingOrganization", _id: [...locationIds].join(","), 
                _count: locationIds.size 
            })).entry.map(e => ({
                locationId: e.resource.id,
                orgId:  e.resource.managingOrganization.reference.split("/")[1]

            }))

            //  get organization id from location of appointment
            apptResult = apptResult.map(obj1 => {
                let obj2 = locationOrg.find(obj2 => obj2.locationId === obj1.locationId);
              
                return { ...obj1, ...obj2 };
            });

            const slotAppt = (await fetchResource("Slot", {
                "_id": [...slotIds].join(","), _count: 5000 
            })).entry.map(e => ({
                slotId: e.resource.id,
                slot: { start: e.resource.start, end: e.resource.end},
                scheduleId: e.resource.schedule.reference.split("/")[1]
            }))

            const apptEncounter = (await fetchResource("Encounter", {
                "appointment": [...apptIds].join(","), _count: 5000
            })).entry.map(e => ({ 
                encStatus: e.resource.status, 
                appointmentId: e.resource.appointment[0].reference.split("/")[1], 
                generatedOn: e?.resource?.period?.start || null } ));

             //combine appointment with slot and encounter status
             const resourceResult = combineAppointmentData(apptResult, locationOrg, slotAppt, apptEncounter, apptStatus);

            const resStatus = bundleStructure.setResponse({ link: config.baseUrl + "Appointment", reqQuery: queryParams }, FHIRData);
            return res.status(200).json({ status: resStatus, message: "Data fetched", total: resourceResult.length, data: resourceResult  })
        }  
    catch(error) {
        console.error("getAppointment Error: ", error)
        return handleError(res, error)
    }
}


const patchAppointmentData = async function(req, res) {
    try {
      const resourceType = "Appointment";
      const reqInput = req.body;
      let resourceResult = [], errData = [];        
      let validationResponse = validateAppointmentPatch(req.body);
      if (validationResponse.error) {
          console.error(validationResponse.error.details)
          return res.status(422).json({status: 0, response: { data: validationResponse.error.details[0] }, message: "Invalid input" })
      }

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
            if(inputData.status.value == "in-progress" && encounterSavedData.entry) {
                encounterSavedData.entry[0].resource.status = "in-progress";
                encounterSavedData.entry[0].resource.period = {
                    "start": inputData.generatedOn,
                    "end": inputData.generatedOn
                }
                let encounterBundle = await bundleStructure.setBundlePost(encounterSavedData.entry[0].resource, encounterSavedData.entry[0].resource.identifier, encounterSavedData.entry[0].resource.id, "PUT", "identifier");  
                resourceResult.push(encounterBundle);
            }
            // update appointment details 
            else if((inputData.status.value == "completed") && encounterSavedData.entry) {
                encounterSavedData.entry[0].resource.status = "finished";
                let encounterBundle = await bundleStructure.setBundlePost(encounterSavedData.entry[0].resource, encounterSavedData.entry[0].resource.identifier, encounterSavedData.entry[0].resource.id, "PUT", "identifier");                   
                resourceResult.push(encounterBundle);
                inputData.createdOn = {
                    "operation": "replace",
                    "value": resourceSavedData.entry[0].resource.created
                }
            }
            let slotPatch = null;
            let appointment = new Appointment(inputData, []);
            appointment.setPatchData(resourceSavedData.entry[0].resource);
            let resourceData = [...appointment.getFHIRResource()];
            const patchUrl = resourceType + "/" + inputData.appointmentId;
            let slotId = resourceSavedData.entry[0].resource.slot[0].reference.split("/")[1];
            let patchResource = await bundleStructure.setBundlePatch(resourceData, patchUrl);
            let slot = new Slot(inputData, []);
            slot.setPatchData();
            let slotPatchResource = [...slot.getFHIRResource()];
            const slotPatchUrl = "Slot/" + slotId;
            slotPatch = await bundleStructure.setBundlePatch(slotPatchResource, slotPatchUrl);
            resourceResult.push(patchResource, slotPatch);
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
        return res.status(500).json({
        status: 0, message: "Unable to process. Please try again.", error: response
        })
    }
}catch(e) {
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