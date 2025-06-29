const BaseEncounter = require('./BaseEncounter');

class SymDiagEncounter extends BaseEncounter {
  constructor(encounterObj, fhirResource) {
    super(encounterObj, fhirResource);
  }

  setSymDiagIdentifier () {
    this.fhirResource.identifier = [
        {
            "system": "https://hl7.org/fhir/sid/sn/diagnosis",
            "value": this.encounterObj.id
        }
    ]
  }
  setBasicSymDiagStructure() {  
    this.setSymDiagIdentifier();
    this.setPartOf();
    this.fhirResource.type = [
        {
            "coding": [
                {
                    "system": "https://your-custom-coding-system",
                    "code": "symptom-diagnosis-encounter",
                    "display": "Symptom Diagnosis encounter"
                }
            ]
        }
    ]
  }

  getJsonToFhirTranslator() {
    super.getJsonToFhirTranslator();
    this.setBasicSymDiagStructure();

  }


  getPractitionerReference() {
    this.encounterObj.practitionerId =
      this.fhirResource?.participant?.[0]?.individual?.reference?.split("/")[1] || null;
  }

  patchSystemDiagnosisSubEncounter(){
    this.fhirResource.length = {
        "value": new Date().valueOf(),
        "unit": "millisecond",
        "system": "https://unitsofmeasure.org",
        "code": "ms"
    };
    return this.fhirResource;
}


  getFHIRToTransformedResult() {
    super.getFHIRToTransformedResult();
    this.getPrimaryEncounterReference();
    this.encounterObj.vitalFhirId = this.fhirResource.id;
    this.encounterObj.vitalUuid = this.fhirResource.identifier?.at(-1)?.value || null;
  }


}

module.exports = SymDiagEncounter;
