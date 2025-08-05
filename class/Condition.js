let idFunction = require("../utils/setGetIdentifier");

//  Used for symptoms and diagnosis
class Condition {
    conditionObj;
    fhirResource;
    reqType;
    constructor(conditionObj, fhir_resource) {
        this.conditionObj = conditionObj;
        this.fhirResource = fhir_resource;
        this.fhirResource.resourceType = "Condition";
    }

    setBasicStructure() {
        this.fhirResource.identifier = [];
        this.fhirResource.category = [{
            "coding": [
              {
                "system": "https://terminology.hl7.org/CodeSystem/condition-category",
                "code": "diagnosis",
                "display": "Diagnosis"
              }
            ]
          }];
          
    }

    setIdentifier() {
        let data = idFunction.setIdAsIdentifier(this.conditionObj, "U");
        this.fhirResource.identifier.push(data);
    }

    getId() {
        this.conditionObj.symDiagFhirId = this.fhirResource.id
    }

    getIdentifier() {
        let data = idFunction.getIdentifier(this.fhirResource, "U");
        this.conditionObj.uuid = data.uuid;
        this.conditionObj.identifier = data.identifier;
    }

    setPatientId() {
        console.log("this.conditionObj: ", this.conditionObj)
        this.fhirResource.subject = {
            "reference": "Patient/" + this.conditionObj.patientId
        }
    }

    setEncounterId() {
        this.fhirResource.encounter = {
            "reference": this.conditionObj.encounterId
        }
    }

    setRecorder() {
        this.fhirResource.recorder = {
            "reference": "Practitioner/" + this.conditionObj.practitionerId
        }
    }
    
    setOnsetDateTime() {
        this.fhirResource.onsetDateTime = this.conditionObj.onsetDateTime
    }


    setDiagnosis() {
        let diagnosis_list = [];
        diagnosis_list.push({
            "system": "https://hl7.org/fhir/sid/icd-10",
            "code": this.conditionObj.diagnosis,
            "display": global.diagnosisMap.get(this.conditionObj.diagnosis) || ""
        });
        this.fhirResource.code = {
            "coding": diagnosis_list
        }
    }

    getDiagnosis() {
        this.conditionObj.diagnosis = {
            code : this?.fhirResource?.code?.coding[0]?.code || "",
            display : this?.fhirResource?.code?.coding[0]?.display || ""
        }
    }

    getCreatedOn() {
        this.conditionObj.createdOn = this?.fhirResource?.appUpdatedDate || null;
    }

    getFHIRToTransformedResult() {
        // this.getId();
        this.getDiagnosis();
        // this.getCreatedOn();
    }

    getJsonToFhirTranslator() {
        this.setBasicStructure();
        this.setIdentifier();
        this.setEncounterId();
        this.setPatientId();
        this.setRecorder();
        this.setDiagnosis();
        this.setOnsetDateTime();
    }

    getSimplifiedOutput() {
        return this.conditionObj.diagnosis;
    }

    getFHIRResource() {
        return this.fhirResource;
    }

    patchRecorder() {
        this.conditionObj.recorder = {
            "reference": "Practitioner/" + this.conditionObj.practitionerId
        }
    }

    patchSymptom() {
        let symptoms_list = []
        this.conditionObj.symptoms.map(symptom => symptoms_list.push({
            "system": "https://www.lattice.in/fhir/ValueSet/symptoms",
             "code": symptom
        }))
        this.conditionObj.evidence = [
            {
                "code": [{"coding": symptoms_list}]
            }
        ]
    }

    patchDiagnosis() {
        let diagnosis_list = [];
        this.conditionObj.diagnosis.map(code => diagnosis_list.push({
            "system": "https://hl7.org/fhir/sid/icd-10",
            "code": code,
        }));
        this.conditionObj.code = {
                "coding": diagnosis_list
        }
        
    }

    setPatchData() {
        this.patchRecorder();
        this.patchSymptom();
        this.patchDiagnosis();
    }
}


module.exports = Condition;