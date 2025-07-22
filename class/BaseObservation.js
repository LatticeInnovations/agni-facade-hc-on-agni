
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
        if(this.observationObj.patientId)
            this.fhirResource.subject.reference = "Patient/" + this.observationObj?.patientId;
        else if(this.observationObj?.patientUuid)
            this.fhirResource.subject.reference = "urn:uuid:" + this.observationObj?.patientUuid;
    }

    getPatientId() {
        this.observationObj.patientId = this.fhirResource.subject.reference.split('/')[1];
    }
    
    getFhirId() {
        this.observationObj.observationId = this.fhirResource.id;
    }
    
    getEncounter() {
        this.observationObj.encounterId = this.fhirResource?.encounter?.reference?.split('/')[1] || null;
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

    setDeceasedReason() {
        console.log("check entered here")
        if(this.observationObj.patientDeceasedReason) {
            this.fhirResource.valueCodeableConcept =  {
                "coding": [
                    {
                        "system": process.env.heartcare_url,
                        "code": null
                    }
                ],
                "text": this.observationObj?.patientDeceasedReason || null
            }
        }

    }

    getDeceasedReason() {
        if(this.fhirResource.valueCodeableConcept) {
            
            const deceasedIndex = this.fhirResource.valueCodeableConcept.coding.findIndex(e => e.system === process.env.heartcare_url)
            console.log(this.fhirResource.valueCodeableConcept.coding, deceasedIndex)
            if(deceasedIndex != -1) {
                 this.observationObj.patientDeceasedReason = this.fhirResource?.valueCodeableConcept?.text || null
            }
            
        }
        else {
            this.observationObj.patientDeceasedReasonId = null;
            this.observationObj.patientDeceasedReason = null
        }
        }


      getJsonToFhirTranslator() {
        this.setBasicStructure();
        this.setEncounterReference();
        this.setPatientReference();
        this.setPractitionerReference();
        this.setDeceasedReason();
      }

      getFHIRToTransformedResult() {
        this.getPatientId()
        this.getFhirId();
        this.getDeceasedReason();
      }

}

module.exports = BaseObservation;