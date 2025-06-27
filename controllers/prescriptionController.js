
const MedicationRequest = require("../class/MedicationRequest");
const Encounter = require("../class/GroupEncounter")
const AppointmentEncounter = require("../class/BaseEncounter")
let axios = require("axios");
let config = require("../config/nodeConfig");
const bundleStructure = require("../services/bundleOperation")
const responseService = require("../services/responseService");


//  Save prescription data
let savePrescriptionData = async function (req, res) {
    try {
        // let response = resourceValid(req.params);
        // if (response.error) {
        //     console.error(response.error.details)
        //     let errData = { status: 0, response: { data: response.error.details }, message: "Invalid input" }
        //     return res.status(422).json(errData);
        // }
        let resourceResult = [];
        for (let patPres of req.body) {
            let appointmentEncounter = await bundleStructure.searchData(config.baseUrl + "Encounter", { "appointment": patPres.appointmentId, _count: 5000 , "_include": "Encounter:appointment"});
            let apptData = appointmentEncounter.data.entry[0].resource
            patPres.uuid = patPres.prescriptionId;
            patPres.code = "prescription-encounter-form";
            patPres.display  = "Prescription management";
            patPres.appointmentEncounterId = apptData.id;
            let encounter = new Encounter(patPres, {})
            const encounterData = encounter.getUserInputToFhir()
            let encounterBundle = await bundleStructure.setBundlePost(encounterData, encounterData.identifier, patPres.uuid, "POST", "identifier"); 
            resourceResult.push(encounterBundle)
            patPres.id = patPres.prescriptionId;
            let medList = patPres.prescription;
            let dateToday = (new Date(patPres.generatedOn)).getTime().toString();
            let lastDigits = dateToday.slice(9, -1);
            let grpIdentify =  lastDigits + patPres.patientId;
           
            for(let prescription of medList) {
                prescription.patientId = patPres.patientId;
                prescription.generatedOn = patPres.generatedOn;
                prescription.prescriptionId = patPres.prescriptionId;
                prescription.encounterId = patPres.uuid
                prescription.grpIdentify = grpIdentify;
                prescription.identifier = [{
                    "system": config.medReqUuidUrl,
                    "value": prescription.medReqUuid
                }, ... encounterData.identifier]
                let medRequest = new MedicationRequest(prescription, {});
                medRequest.getJSONtoFhir();
                let medReqData = {...medRequest.getFhirResource()};
                medReqData.resourceType = "MedicationRequest";
                medReqData.id = prescription.medReqUuid;
                let medReqResource = await bundleStructure.setBundlePost(medReqData, prescription.identifier, medReqData.id, "POST", "identifier");
                resourceResult.push(medReqResource); 
            }
        }
        let bundleData = await bundleStructure.getBundleJSON({resourceResult})  
        let response = await axios.post(config.baseUrl, bundleData.bundle); 
        console.info("get bundle json response: ", response.status)  
        if (response.status == 200 || response.status == 201) {
            let responseData = setPrescriptionResponse(bundleData.bundle.entry, response.data.entry, "post");        //    
            res.status(201).json({ status: 1, message: "Practitioner data saved.", data: responseData })
        }
        else {
                return res.status(500).json({
                status: 0, message: "Unable to process. Please try again.", error: response
            })
        }
    }
    catch (e) {
        console.error(e);
        return res.status(500).json({
            status: 0,
            message: "Unable to process. Please try again.",
            error: e
        })
    }

}

//  Get Practitioner data
let getPrescriptionData = async function (req, res) {
    try {
        const link = config.baseUrl + "Encounter";
        let queryParams = {
            "_revinclude": "MedicationRequest:encounter:Encounter",
            "type": "prescription-encounter-form",
            "_total": "accurate",
            "_count": 3000,
            "patient": req.query.patientId
        }
        let resourceResult = []
        let responseData = await bundleStructure.searchData(link, queryParams);
        let resStatus = 1;

        console.info("FHIRData: ", responseData)
        if( !responseData.data.entry || responseData.data.total == 0) {
                return res.status(200).json({ status: resStatus, message: "Data fetched", total: 0, data: []  })
        }
        const FHIRData = responseData.data.entry;
        const prescriptionFormEncounter = FHIRData.filter(e => e.resource.resourceType == "Encounter").map(e => e.resource)
        let appointmentEncounterIds = [... new Set(prescriptionFormEncounter.map(e =>  parseInt(e.partOf.reference.split("/")[1])))]
        let appointmentEncounters = await bundleStructure.searchData(config.baseUrl + "Encounter", { "_id": appointmentEncounterIds.join(","), _count: 5000});
        appointmentEncounters = appointmentEncounters.data.entry.map(e=> e.resource)
        
        for(let encData of prescriptionFormEncounter) {
            // map the encounter from the list to sub encounter of prescription
            let apptEncounter = appointmentEncounters.filter( e=> e.id == encData.partOf.reference.split("/")[1])
            apptEncounter = new AppointmentEncounter({}, apptEncounter[0]);
            apptEncounter = apptEncounter.getFhirToJson();
            console.info("apptEncounter: ", apptEncounter)
            let medReqList = FHIRData.filter(e => e.resource.resourceType == "MedicationRequest" && e.resource.encounter.reference == "Encounter/"+encData.id).map(e => e.resource);    
            let prescriptionData = {
                "prescriptionId": encData.identifier[0].value,
                "prescriptionFhirId": encData.id,
                "generatedOn": encData.period.start
            }   
            prescriptionData = {...apptEncounter, ...prescriptionData}
            prescriptionData.prescription = [];
        //  let insert = false;
            for(let medReq of medReqList) {   
                medReq.prescriptionId = encData.prescriptionId                  
                let medReqData = new MedicationRequest({}, medReq);
                medReqData.getFhirToJson();
                let medData = medReqData.getMedReqResource();
                medData.qtyPrescribed = medData.qtyPerDose * medData.frequency * medData.duration;
                prescriptionData.prescription.push(medData);
            }
            if(prescriptionData.prescription.length > 0)
                resourceResult.push(prescriptionData)
        }
        
        res.status(200).json({ status: resStatus, message: "Data fetched.", total: resourceResult.length,"offset": +queryParams?._offset, data: resourceResult  })
        
    }
    catch(e) {
        console.error("Error",e)
        return res.status(200).json({
                status: 0,
                message: "Unable to process. Please try again"
            })
       
    }
}


const setPrescriptionResponse  = (reqBundleData, responseBundleData, type) => {
    let filteredData = [];
    let response = [];
    const responseData = bundleStructure.mapBundleService(reqBundleData, responseBundleData)
    filteredData = responseData.filter(e => e.resource.resourceType != "MedicationRequest" && e.resource.resourceType == "Encounter");            
    filteredData = filteredData.map(e => {              
        let medReqData = responseData.filter(medReq => medReq.resource.resourceType == "MedicationRequest" && medReq.resource.identifier[1].value == e.resource.identifier[0].value)
        console.info("medReqData", medReqData)
        medReqData = medReqData.map(element => {
            return {
                medReqUuid :element.resource.identifier[0].value, 
                medReqFhirId : element.response.location.substring(element.response.location.indexOf("/") + 1, element.response.location.indexOf("/_history"))
            }
        })
        e.prescription = medReqData
        return e
    });   
    response = responseService.setDefaultResponse("MedicationRequest", type, filteredData)
    for(let i=0; i<response.length; i++) {
        response[i].prescription = filteredData[i].prescription || []
    }
    return response;
}


module.exports = {
    savePrescriptionData,
    getPrescriptionData
}