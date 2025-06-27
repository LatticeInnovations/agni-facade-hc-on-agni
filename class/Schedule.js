let idFunction = require("../utils/setGetIdentifier")
class Schedule {
    scheduleObj;
    fhirResource;
    reqType;
    constructor(scheduleObj, fhir_resource) {
        this.scheduleObj = scheduleObj;
        this.fhirResource = fhir_resource;
        this.fhirResource.resourceType = "Schedule"
    }

    setBasicStructure() {
        this.fhirResource.identifier = [];
        this.fhirResource.actor = [];
        this.fhirResource.planningHorizon = {};
    }

    setIdentifier() {
        let data = idFunction.setIdAsIdentifier(this.scheduleObj, "U");
        this.fhirResource.identifier.push(data);
    }

    getIdentifier() {
        let data = idFunction.getIdentifier(this.fhirResource, "U");
        this.scheduleObj.uuid = data.uuid;
        this.scheduleObj.identifier = data.identifier;
    }
    
    setStatus() {
        this.fhirResource.active = true;
       }
    
    getStatus() {
        this.scheduleObj.active = this.fhirResource.active;
    }

    setActor() {
        this.fhirResource.actor.push({
            "reference": "Location/" + this.scheduleObj.locationId
        })
    }

    getActor() {
        this.scheduleObj.orgId = this.fhirResource.orgId;
    }

    setPlanningHorizon() {
        this.fhirResource.planningHorizon = this.scheduleObj.planningHorizon;
    }

    getPlanningHorizon() {
        this.scheduleObj.planningHorizon = this.fhirResource.planningHorizon;
    }

    getId() {
        this.scheduleObj.scheduleId = this.fhirResource.id;
        this.scheduleObj.uuid = this.fhirResource.identifier[0].value
    }   

    getFHIRToTransformedResult() {
        this.getId();
        this.getPlanningHorizon();
        this.getActor();     
        this.getStatus();  
    }

    getJsonToFhirTranslator() {
        this.setBasicStructure()
        this.setIdentifier();
        this.setStatus();
        this.setActor();
        this.setPlanningHorizon();
    }

    getSimplifiedOutput() {
        return this.scheduleObj;
    }

    getFHIRResource() {
        return this.fhirResource;
    }

}


module.exports = Schedule;