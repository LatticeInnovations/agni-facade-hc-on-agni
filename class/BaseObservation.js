
class BaseObservation {
    observationObj;
    fhirResource;
    constructor(observationObj, fhirResource){
        this.observationObj = observationObj;
        this.fhirResource = fhirResource;
    }

    setPractitionerReference() {
        this.fhirResource.performer = [
            {
                "reference": "Practitioner/" + this.observationObj.practitionerId,
            }
        ];
    }

    setEncounterReference() {
        if(this.observationObj?.encounterId) {
            this.fhirResource.encounter.reference = 'urn:uuid:' + this.observationObj?.encounterId;
        }
       
    }

    getSimplifiedOutput() {
        return this.observationObj;
    }
    
    getFHIRResource() {
        return this.fhirResource;
    }


    setPatientReference() {
        this.fhirResource.subject.reference = "Patient/" + this.observationObj?.patientId;
    }

    getPatientId() {
        this.observationObj.patientId = this.fhirResource.subject.reference.split('/')[1];
    }
    
    getFhirId() {
        this.observationObj.observationId = this.fhirResource.id;
    }
    
    getEncounter() {
        this.observationObj.encounterId = this.fhirResource.encounter.reference.split('/')[1];
    }

    setBasicStructure() {
        this.fhirResource.subject = {};
        this.fhirResource.encounter = {};
        this.fhirResource.component = [];
        this.fhirResource.status = "final";
        this.fhirResource.resourceType = "Observation";
        this.fhirResource.effectiveDateTime = this.observationObj?.createdOn || new Date().toISOString();
        this.fhirResource.category = [
            {
              "coding": [
                {
                  "system": "https://terminology.hl7.org/CodeSystem/observation-category",
                  "code": this.observationObj?.categoryCode || "vital-signs",
                  "display": this.observationObj?.categoryDisplay || "Vitals"
                }
              ]
            }
        ];
    }

    setCommonVitalsStructure() {
        this.setBasicStructure();
        this.setEncounterReference();
        this.setPatientReference();
        this.setPractitionerReference();
      }
}

module.exports = BaseObservation;