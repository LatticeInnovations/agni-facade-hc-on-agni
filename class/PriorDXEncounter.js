const BaseEncounter = require('./BaseEncounter');

class PriorDxEncounter extends BaseEncounter {
  constructor(encounterObj, fhirResource) {
    super(encounterObj, fhirResource);
  }

  setBasicCVDStructure() {
    this.setPartOf();
    this.fhirResource.type = [{
        coding: [
          {
            system: "https://your-custom-coding-system",
            code:  this.encounterObj.type,
            display:  this.encounterObj.type
          }
        ]
      }
    ];
  }

  setOrganizationReference(){
    this.fhirResource.serviceProvider = null;
  }


  getJsonToFhirTranslator() {
    super.getJsonToFhirTranslator();
    this.setBasicCVDStructure();

  }

  getPractitionerReference() {
    this.encounterObj.practitionerId =
      this.fhirResource?.participant?.[0]?.individual?.reference?.split("/")[1] || null;
  }



  getFHIRToTransformedResult() {
    super.getFHIRToTransformedResult();
    this.getPrimaryEncounterReference();
    this.encounterObj.priorDxFhirId = this.fhirResource.id;
    this.encounterObj.uuid = this.fhirResource.identifier?.at(-1)?.value || null;
  }
}

module.exports = PriorDxEncounter;
