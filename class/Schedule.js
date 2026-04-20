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

    setServiceType() {
        this.fhirResource.serviceType = [
            {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/service-type",
                        "code": this.scheduleObj.serviceType,
                        display: this.scheduleObj.serviceType
                    }
                ]
            }
        ]
    }
    
    setStatus() {
        this.fhirResource.active = true;
       }
    
    getStatus() {
        this.scheduleObj.active = this.fhirResource.active;
    }

    setCampaignId() {
        if(this.scheduleObj.campaignId) {
            this.fhirResource.actor.push({
                "reference": "Location/" + this.scheduleObj.campaignId
            })
        }
    }

    getCampaignId() {
        if( this.fhirResource.actor) {
            const index = this.fhirResource.actor.findIndex(e => e.reference.split("/")[0] === "Location")
            if(index > -1)
                this.scheduleObj.campaignId = this.fhirResource.actor[index].reference.split("/")[1];
            else 
            this.scheduleObj.campaignId = null;
        }
        else {
            this.scheduleObj.campaignId = null;
        }
    }

    setActor() {
        if(!this.scheduleObj.campaignId) {
            this.fhirResource.actor.push({
                "reference": "PractitionerRole/" + this.scheduleObj.roleId
            })
        }

    }

    getActor() {
        if(this.fhirResource.actor) {
            const index = this.fhirResource.actor.findIndex(e => e.reference.split("/")[0] === "PractitionerRole")
            if(index > -1)
                this.scheduleObj.roleId = this.fhirResource.actor[index].reference.split("/")[1];
            else
                this.scheduleObj.roleId = null
        }
        else {
            this.scheduleObj.roleId = null;
        }
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
        this.getCampaignId();  
        this.getStatus();  
    }

    getJsonToFhirTranslator() {
        this.setBasicStructure()
        this.setIdentifier();
        this.setServiceType();
        this.setCampaignId();
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