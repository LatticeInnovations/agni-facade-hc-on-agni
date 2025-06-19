const config = require("../config/nodeConfig");
let idFunction = require("../utils/setGetIdentifier");
class Observation {
    observationObj;
    fhirResource;
    constructor(observationObj, fhirResource){
        this.observationObj = observationObj;
        this.fhirResource = fhirResource;
        this.resourceType = "Observation"
    }

    setPractitionerReference() {
        this.fhirResource.performer = [
            {
                "reference": "Practitioner/" + this.observationObj.practitionerId,
            }
        ];
    }

 
    setPatientReference() {
        this.fhirResource.subject.reference = "Patient/" + this.observationObj?.patientId;
    }



    setEncounterReference() {
        this.fhirResource.encounter.reference = this.observationObj?.newEnc ? 'urn:uuid:' + this.observationObj?.encounterId : "Encounter/" + this.observationObj?.encounterId;
    }

    setSymptoms() {
      console.log(this.observationObj)
        this.observationObj.symptoms.forEach(symptom => {
            this.fhirResource.component.push({
                "code": {
                "coding": [
              {
                "system": "https://snomed.info/sct",
                "code": symptom,
                "display": global.symptomsMap.get(symptom) || symptom 
              }
            ],
            "text": global.symptomsMap.get(symptom) || symptom
          }
            })
        })  
        
    }

    

    getSymptoms() {
      this.observationObj.symptoms = this.fhirResource.component.map(e => {
        return {
          "code": e.code.coding[0].code,
          "display": e.code.coding[0].display
        }
      })
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

    setIdentifier() {
        let data = idFunction.setIdAsIdentifier(this.observationObj, "U");
        this.fhirResource.identifier.push(data);
    }
    setBasicStructure() {
        this.fhirResource.identifier = [];
        this.fhirResource.subject = {};
        this.fhirResource.encounter = {};
        this.fhirResource.status = "final";
        this.fhirResource.resourceType = "Observation";
        this.fhirResource.effectiveDateTime = this.observationObj?.createdOn || new Date().toISOString();
        this.fhirResource.category = [
            {
                "coding": [
                  {
                    "system": "https://terminology.hl7.org/CodeSystem/observation-category",
                    "code": "symptom",
                    "display": "Symptom"
                  }
                ]
              }
        ];
        this.fhirResource.code = {
            "coding": [
              {
                "system": "https://terminology.hl7.org/CodeSystem/observation-category",
                "code": "symptom",
                "display": "Symptoms"
              }
            ],
            "text": "Symptoms"
          }
        this.fhirResource.component = []
    }

    setJsonTOFhir() {
        this.setBasicStructure();
        this.setIdentifier();
        this.setPatientReference();
        this.setEncounterReference();
        this.setPatientReference();
        this.setSymptoms()
        return this.fhirResource
    }

    getFhirToJson() {
      this.getFhirId();
      this.getEncounter();
      this.getPatientId();
      this.getSymptoms()
      return this.observationObj
    }
    patchResource() {
      this.setSymptoms()
      return this.fhirResource
    }

}

module.exports = Observation;