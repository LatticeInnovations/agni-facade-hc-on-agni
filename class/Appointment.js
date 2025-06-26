let idFunction = require("../utils/setGetIdentifier");
let apptStatus = require("../utils/appointmentStatus.json");
const config = require("../config/nodeConfig");
class Appointment {
    apptObj;
    fhirResource;
    reqType;
    constructor(apptObj, fhir_resource) {
        this.apptObj = apptObj;
        this.fhirResource = fhir_resource;
        this.fhirResource.resourceType = "Appointment";
    }

    setBasicStructure() {
        this.fhirResource.identifier = [];
        this.fhirResource.slot = [];
        this.fhirResource.participant = [];
        this.fhirResource.appointmentType = {};
    }

    setIdentifier() {
        let data = idFunction.setIdAsIdentifier(this.apptObj, "U")
        this.fhirResource.identifier.push(data);
    }

    getIdentifier() {
        let data = idFunction.getIdentifier(this.fhirResource, "U");
        this.apptObj.uuid = data.uuid;
    }
    
    setStatus() {
        let statusData = apptStatus.find(e => e.uiStatus == this.apptObj.status);
        console.info("statusData", statusData, this.apptObj.status, apptStatus)
        this.fhirResource.status = statusData.fhirStatus;
        this.fhirResource.appointmentType.coding = [
            {
                "system": config.sctCodeUrl,
                "code": this.apptObj.status == "in-progress" ? this.apptObj.appointmentType : statusData.type    
            }
        ]
    }
    
    getStatus() {
        this.apptObj.apptType =  this.fhirResource.appointmentType.coding[0].code;
        this.apptObj.apptStatus =  this.fhirResource.status
    }

    patchStatus() {
    if(this.apptObj.status) {
        let statusData = apptStatus.find(e => e.uiStatus == this.apptObj.status.value);
        this.fhirResource.push({ "op": this.apptObj.status.operation, "path": "/status", value: statusData.fhirStatus });    
        }
    }

    setSlot() {
        this.fhirResource.slot.push({
            "reference": "urn:uuid:" + this.apptObj.slotUuid
        })
    }

   setParticipant() {
    this.fhirResource.participant.push({
        actor : { "reference": "Patient/" + this.apptObj.patientId }
    });
    this.fhirResource.participant.push({
        actor : { "reference": "Location/" + this.apptObj.locationId } 
    })
    console.info("", this.fhirResource.participant)
   }

   getParticipant() {
    this.apptObj.patientId = this.fhirResource.participant[0].actor.reference.split("/")[1];
    this.apptObj.locationId = this.fhirResource.participant[1].actor.reference.split("/")[1];
   }

    getSlot() {
        this.apptObj.slot = this.fhirResource.slot;
    }

    patchSlot() {
        if (this.apptObj.status && this.apptObj.status.value == "scheduled") {
            this.fhirResource.push({ "op": this.apptObj.slot.operation, "path": "/slot/"+0, value: this.apptObj.slot.value });  
        }


    }

    setCreated() {
        this.fhirResource.created = this.apptObj.createdOn;
    }

    patchCreatedOn() {
        if(this.apptObj.status.value == "scheduled")
            this.fhirResource.push({ "op": this.apptObj.createdOn.operation, "path": "/created", value: this.apptObj.createdOn.value }); 

    }

    getCreated() {
        this.apptObj.createdOn = this.fhirResource.created;
    }

    setStart() {
         this.fhirResource.start = this.apptObj.slot.start;
    }

    getId() {
        this.apptObj.appointmentId = this.fhirResource.id;
    }   

    getAppointmentType() {
        this.apptObj.appointmentType = this?.fhirResource?.appointmentType?.coding?.[0]?.code || null;
    }

    getFHIRToTransformedResult() {
        this.getId();
        this.getIdentifier();
        this.getStatus();
        this.getSlot();
        this.getParticipant();
        this.getCreated();
        this.getAppointmentType();
    }

    getJsonToFhirTranslator() {
        this.setBasicStructure()
        this.setIdentifier();
        this.setStatus();
        this.setSlot();
        this.setStart();
        this.setParticipant();
        this.setCreated();
    }

    setPatchData() {
        this.patchStatus();
        this.patchCreatedOn();    

    }

    getSimplifiedOutput() {
        return this.apptObj;
    }

    getFHIRResource() {
        return this.fhirResource;
    }

}


module.exports = Appointment;