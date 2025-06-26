let axios = require("axios");
let Slot = require("../class/Slot")
let Encounter = require("../class/encounter");
let Appointment = require("../class/Appointment");
const bundleStructure = require("../services/bundleOperation");
const responseService = require("../services/responseService");
const { v4: uuidv4 } = require('uuid');
let appointmentValidation = require("../utils/Validator/scheduleAppointment").validateAppointmentArray;
let apptPatchValidation = require("../utils/Validator/scheduleAppointment").apptPatchValidation;
const {validateRequest} = require("../utils/validateRequest")
let apptStatus = require("../utils/appointmentStatus.json");
let config = require("../config/nodeConfig");


const fetchLocationResource = async (orgId) => {
    // get location id of the organization sent by app and map it to the appointments
    const locationResource = await bundleStructure.searchData(config.baseUrl + "Location", { organization: "Organization/" + orgId, _elements: "id", _total: "accurate" });
    if (!locationResource.data) {
        throw new Error("Location not found for the given organization.");
    }
    return locationResource.data.entry[0].resource.id;
}

let setAppointmentData = async function (req, res) {
    try {
        let resourceResult = [];
        const resType = "Appointment";
        validateRequest(req, res, appointmentValidation);
        for (let apptData of req.body) {
            const locationId = await fetchLocationResource(apptData.orgId)
            apptData.locationId = locationId;
            let slotData = apptData.slot;
            // generate slot of  the given schedule
            slotData.scheduleId = apptData.scheduleId;
            slotData.uuid = uuidv4();
            let slot = new Slot(slotData, {})
            slot.getJsonToFhirTranslator();
            let slotResource = slot.getResource();
            let slotBundle = await bundleStructure.setBundlePost(slotResource, null, slotData.uuid, "POST", "object");
            apptData.slotUuid = slotData.uuid;
            resourceResult.push(slotBundle);
            let appt = new Appointment(apptData, {});
            appt.getJsonToFhirTranslator();
            let apptResource = {};
            apptResource = { ...appt.getResource() };
            apptResource.resourceType = resType;
            let encounter = new Encounter(apptData, {});
            encounter.getUserInputToFhir();
            let encounterResource = {...encounter.getFHIRResource()};
            encounterResource.resourceType = "Encounter";
            let encounterUuid =  uuidv4();
            // constraint to not allow multiple appointments creation for same patient  on same Time for same organization
            let noneExistDataAppt = [
                    { "key": "identifier", "value": apptResource.identifier[0].system +"|" + apptResource.identifier[0].value},
                    { "key": "location", "value": 'Location/' + locationId },
                    { "key": "patient", "value": 'Patient/' + apptData.patientId }
                ]
            let apptBundle = await bundleStructure.setBundlePost(apptResource, noneExistDataAppt, apptData.uuid, "POST", "object");              
            let encounterBundle = await bundleStructure.setBundlePost(encounterResource, encounterResource.identifier, encounterUuid, "POST", "identifier");
            resourceResult.push(apptBundle, encounterBundle);
        
        }
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
                return res.status(500).json({status: 0, message: "Unable to process. Please try again.", error: response})
        }

    }
    catch (e) {
        return res.status(500).json({status: 0, message: "Unable to process. Please try again.", error: e})
    }

}

const getAppointment = async function(req, res) {
    try {
            let queryParams = {
                _total : "accurate",
                _count: req.query._count,
                _offset: req.query._offset,
                _sort: req.query._sort
            }
            queryParams["location.organization"] = req.query.orgId;
            const link = config.baseUrl + "Appointment";
            let resourceResult = [];
            let resourceUrlData = { link: link, reqQuery: queryParams, allowNesting: 1, specialOffset: 1 }
            let responseData = await bundleStructure.searchData(link, queryParams);
            console.info("responseData: ", responseData)
            let resStatus = 1;
            if( !responseData.data.entry || responseData.data.total == 0) {
                return res.status(200).json({ status: resStatus, message: "Data fetched", total: 0, data: []  })
            }
             // get all the details of appointment
             let locationIds = new Set(); let apptIds = new Set(), slotIds = new Set(); let apptResult = [];
             const FHIRData = responseData.data.entry
             for (let apptData of FHIRData) {
                 let appointment = new Appointment({}, apptData.resource);
                 appointment.getFHIRToTransformedResult();
                 let apptResponse = appointment.getInput();
                 console.info(apptResponse)
                 apptIds.add(apptResponse.appointmentId);
                 locationIds.add(apptResponse.locationId);
                 let slotId = apptData.resource.slot ? apptData.resource.slot[0].reference.split("/")[1] : null;
                 slotIds.add(slotId);
                 apptResponse.slotId = slotId;
                 apptResult.push(apptResponse);
             }
             // get organization id of an appointment
             let orgResource = await bundleStructure.searchData(config.baseUrl + "Location", { _elements: "managingOrganization", _id: [...locationIds].join(","), _count: locationIds.size });
 
             let locationOrg = orgResource.data.entry.map(e => { return { locationId: e.resource.id, orgId: e.resource.managingOrganization.reference.split("/")[1] } });
             apptResult = apptResult.map(obj1 => {
                 let obj2 = locationOrg.find(obj2 => obj2.locationId === obj1.locationId);
               
                 return { ...obj1, ...obj2 };
             });
             // get assigned slot and schedule data of an appointment
             let slotList = await bundleStructure.searchData(config.baseUrl + "Slot", { "_id": [...slotIds].join(","), _count: 5000 });
             let slotAppt = slotList.data.entry.map(e => { return { slotId: e.resource.id, slot: { start: e.resource.start, end: e.resource.end}, scheduleId: e.resource.schedule.reference.split("/")[1] } });
             let encounterList = await bundleStructure.searchData(config.baseUrl + "Encounter", { "appointment": [...apptIds].join(","), _count: 5000 });
             let apptEncounter = encounterList.data.entry.map(e => { return { encStatus: e.resource.status, appointmentId: e.resource.appointment[0].reference.split("/")[1], generatedOn: e?.resource?.period?.start || null } });
             //combine appointment with slot and encounter status
             resourceResult = apptResult.map(obj1 => {
                 let obj2 = slotAppt.find(obj2 => obj2.slotId === obj1.slotId);
                 let obj3 = apptEncounter.find(obj3 => obj3.appointmentId == obj1.appointmentId);
                  let statusData = apptStatus.find(e => e.fhirStatus == obj1.apptStatus && e.encounter == obj3.encStatus && e.type == obj1.apptType);
                  console.info(obj1.appointmentId, obj1.apptStatus, obj1.apptType, obj3.encStatus, statusData)
                  obj1.status = statusData.uiStatus;
                 if(typeof obj2 == "undefined") {
                     obj2 = {slot: null, slotId: null};
                     obj1.scheduleId = null;
                 }
                 delete obj1.apptType;
                 delete obj1.apptStatus;
                 delete obj3.encStatus;
                 return { ...obj1, ...obj2, ...obj3 };
             });
            resStatus = bundleStructure.setResponse(resourceUrlData, responseData);
            res.status(200).json({ status: resStatus, message: "Data fetched", total: resourceResult.length, data: resourceResult  })
        }  
    catch(e) {
        console.error("Error: ", e)
    }
}


const patchAppointmentData = async function(req, res) {
    try {
      const resourceType = "Appointment";
      const reqInput = req.body;
      let resourceResult = [], errData = [];
      for (let inputData of reqInput) {
        let validationResponse = apptPatchValidation(inputData);
        if (validationResponse.error) {
            console.error(response.error.details)
            return res.status(422).json({status: 0, response: { data: response.error.details[0] }, message: "Invalid input" })
        }
        let link = config.baseUrl + resourceType;
        let resourceSavedData = await bundleStructure.searchData(link, { "_id": inputData.appointmentId });
        let encounterSavedData =  await bundleStructure.searchData(config.baseUrl + "Encounter", { "appointment": inputData.appointmentId });
        if (resourceSavedData.data.total != 1) {
            return res.status(422).json( { status: 0, message: "Appointment Id " + inputData.appointmentId + " does not exist."})
        }
        else if(resourceSavedData.data.entry[0].resource.status == "cancelled" || resourceSavedData.data.entry[0].resource.status == "noshow") {
            // once appointment status is no-show and cancelled it cannot be changed.
            errData.push({
                "status": "422",
                "id": null,
                "err": "Appointment data not changed as status is " + resourceSavedData.data.entry[0].resource.status,
                "fhirId": inputData.appointmentId
            })
        }
        else {
            if(inputData.status.value == "in-progress" && encounterSavedData.data.entry) {
                encounterSavedData.data.entry[0].resource.status = "in-progress";
                encounterSavedData.data.entry[0].resource.period = {
                    "start": inputData.generatedOn,
                    "end": inputData.generatedOn
                }
                let encounterBundle = await bundleStructure.setBundlePost(encounterSavedData.data.entry[0].resource, encounterSavedData.data.entry[0].resource.identifier, encounterSavedData.data.entry[0].resource.id, "PUT", "identifier");  
                resourceResult.push(encounterBundle);
            }
            // update appointment details 
            else if((inputData.status.value == "completed") && encounterSavedData.data.entry) {
                encounterSavedData.data.entry[0].resource.status = "finished";
                let encounterBundle = await bundleStructure.setBundlePost(encounterSavedData.data.entry[0].resource, encounterSavedData.data.entry[0].resource.identifier, encounterSavedData.data.entry[0].resource.id, "PUT", "identifier");                   
                resourceResult.push(encounterBundle);
                inputData.createdOn = {
                    "operation": "replace",
                    "value": resourceSavedData.data.entry[0].resource.created
                }
            }
            let slotPatch = null;
            let appointment = new Appointment(inputData, []);
            appointment.patchUserInputToFHIR(resourceSavedData.data.entry[0].resource);
            let resourceData = [...appointment.getResource()];
            const patchUrl = resourceType + "/" + inputData.appointmentId;
            let slotId = resourceSavedData.data.entry[0].resource.slot[0].reference.split("/")[1];
            let patchResource = await bundleStructure.setBundlePatch(resourceData, patchUrl);
            let slot = new Slot(inputData, []);
            slot.patchUserInputToFHIR();
            let slotPatchResource = [...slot.getResource()];
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
    console.error("Error",e)
    return res.status(200).json({
            status: 0,
            message: "Unable to process. Please try again"
        }) 
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