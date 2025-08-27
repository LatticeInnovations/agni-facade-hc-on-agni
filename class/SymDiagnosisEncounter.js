const BaseEncounter = require('./BaseEncounter');

class SymDiagEncounter extends BaseEncounter {
  constructor(encounterObj, fhirResource) {
    super(encounterObj, fhirResource);
  }

  setSymDiagIdentifier () {
    this.fhirResource.identifier = [
        {
            "system": "https://hl7.org/fhir/sid/sn/diagnosis",
            "value": this.encounterObj.uuid
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

  this.fhirResource.serviceProvider = null
  this.fhirResource.appointment = {
    reference: "Appointment/"+ this.encounterObj.appointmentId
  }
 }

 setNote() {
  this.fhirResource.extension = [
    {
      "url": "http://example.org/fhir/StructureDefinition/encounter-note",
      "valueAnnotation": {
        "text": this.encounterObj.progressNote ?? null
      }
    }
  ]
 }

  getJsonToFhirTranslator() {
    super.getJsonToFhirTranslator();
    this.setBasicSymDiagStructure();
    this.setNote();

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
    this.encounterObj.uuid = this.fhirResource.identifier?.[0].value || null;
  }


}

module.exports = SymDiagEncounter;
