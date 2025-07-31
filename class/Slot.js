let idFunction = require("../utils/setGetIdentifier");


class Slot {
    slotObj;
    fhirResource;
    reqType;
    constructor(slotObj, fhir_resource) {
        this.slotObj = slotObj;
        this.fhirResource = fhir_resource;
        this.fhirResource.resourceType = "Slot";
    }

    setBasicStructure() {
        this.fhirResource.identifier = [];
        this.fhirResource.schedule = {};
    }

    setIdentifier() {
        let data = idFunction.setIdAsIdentifier(this.slotObj, "U");
        this.fhirResource.identifier.push(data);
    }

    getIdentifier() {
        let data = idFunction.getIdentifier(this.fhirResource, "U");
        this.slotObj.uuid = data.uuid;
        this.slotObj.identifier = data.identifier;
    }
    
    setStatus() {
        this.fhirResource.status = "free";
       }
    
    getStatus() {
        this.slotObj.status = this.fhirResource.status;
    }


    setSchedule() {
        this.fhirResource.schedule= {
            "reference": "Schedule/" + this.slotObj.scheduleId
        }
    }

    patchSchedule() {
        if(this.slotObj.scheduleId && this.slotObj.scheduleId.operation == "replace" )
        this.fhirResource.push({ "op": this.slotObj.scheduleId.operation, "path": "/schedule/reference", value: "Schedule/" +  this.slotObj.scheduleId.value }); 
    }

    getSchedule() {
        this.slotObj.scheduleId = this.fhirResource.schedule.reference.split("/")[1];
    }

   setStartEnd() {
    this.fhirResource.start = this.slotObj.start;
    this.fhirResource.end = this.slotObj.end;
   }

   getStartEnd() {
    this.slotObj = {
        start: new Date(this.fhirResource.start).toISOString(),
        end: new Date(this.fhirResource.end).toISOString()
    };
   }

   patchSlotTime() {
    if(this.slotObj.slot && this.slotObj.slot.operation == "replace")
    this.fhirResource.push({ "op": this.slotObj.slot.operation, "path": "/start", value: this.slotObj.slot.value.start }, { "op": this.slotObj.slot.operation, "path": "/end", value: this.slotObj.slot.value.end }); 
   }

    getId() {
        this.slotObj.scheduleId = this.fhirResource.id;
    }   

    getFHIRToTransformedResult() {
        this.getId();
        this.getStatus();
        this.getSchedule();
        this.getStartEnd();
    }

    getJsonToFhirTranslator() {
        this.setBasicStructure();
        this.setStatus();
        this.setSchedule();
        this.setStartEnd();
    }

    setPatchData() {
        this.patchSchedule();
        this.patchSlotTime();
    }

    getSimplifiedOutput() {
        return this.slotObj;
    }

    getFHIRResource() {
        return this.fhirResource;
    }
}


module.exports = Slot;