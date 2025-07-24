const Condition = require("./Condition");

class PriorDxCondition extends Condition {
   
    setBasicStructure() {
        this.fhirResource.identifier = [];
        this.fhirResource.clinicalStatus = "active"
        this.fhirResource.category = [{
            "coding": [
              {
                "system": "http://terminology.hl7.org/CodeSystem/condition-category",
                "code": "problem-list-item",
                "display": "Problem List Item"
              }
            ]
          }];
          this.fhirResource.code = []
    }

    setEncounterId() {
        this.fhirResource.encounter = {
            "reference": this.conditionObj.encounterId
        }
    }

    setCode() {
        this.fhirResource.code = {
         "coding": [
                  {
                     "system" : "http://snomed.info/sct",
                     "code": this.conditionObj.code,
                     "display": this.conditionObj.display,
                     "userSelected": this.conditionObj.booleanValue, 
                  }
               ],
               "text": this.conditionObj.textValue 
         }        
    }

    getCode() {
      const codeMap = {
        "38341003": "hasHypertension",
        "195967001": "hasAsthma",
        "5626500": "hasHeartDiseases",
        "13645005": "hasChronicObstructivePulmonaryDisease",
        "266257000": "hasTransientIschaemicAttack",
        "709044004": "hasChronicKidneyDiseases",
        "73211009": "hasDiabetes",
        "56717001": "hasTuberculosis",
        "13644009": "hasHypercholesterolaemia",
        "62479008": "hasAids",
        "1240414004": "hasCancer",
        "74964007": "hasOthers",
        "840539006": "hasCovid"
      };
      const code = this.fhirResource.code.coding[0].code;
      const userSelected = this.fhirResource.code.coding[0].userSelected;
      const codeKey = codeMap[code];
      this.conditionObj[codeKey] = userSelected;
      if (code === "74964007") {
        this.conditionObj.others = userSelected ? this.fhirResource.code.text : null;
      }
    
      if (code === "1240414004") {
        this.conditionObj.cancer = userSelected ? this.fhirResource.code.text : null;
      }
}

    getIdentifier() {
      this.conditionObj.uuid = this.fhirResource.identifier?.[0]?.value || null;
   }

    getId() {
      this.conditionObj.priorDxFhirId = this.fhirResource.id
    }

    getGeneratedOn() {
      this.conditionObj.generatedOn = this?.fhirResource?.onsetDateTime || null;
   }



   getPatientId() {
      this.conditionObj.patientId = this.fhirResource.subject.reference.split("/")
   }

   getPractitionerId() {
      this.conditionObj.practitionerID = this.fhirResource.recorder.reference.split("/")
   }

    getJsonToFhirTranslator() {
        this.setBasicStructure();
        this.setIdentifier();
        this.setEncounterId();
        this.setPatientId();
        this.setRecorder();
        this.setCode();
        this.setOnsetDateTime();
    }

    getFHIRToTransformedResult() {
      // this.getId();
      // this.getGeneratedOn();
      // this.getIdentifier();
      // this.getPatientId();
      this.getCode();
      // this.getPractitionerId();
  }
  getSimplifiedOutput() {
    return this.conditionObj
  }
}

module.exports = PriorDxCondition