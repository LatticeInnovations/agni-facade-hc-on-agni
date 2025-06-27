const BaseEncounter = require('./BaseEncounter');

class LabEncounter extends BaseEncounter {
  constructor(encounterObj, fhirResource) {
    super(encounterObj, fhirResource);
  }

  getUserInputToFhir() {
    this.setStructureForEncounter();
    this.fhirResource.type = [
      {
        coding: [
          {
            system: "https://your-custom-coding-system",
            code: "lab-report-encounter",
            display: "Lab Report encounter"
          }
        ]
      }
    ];

    this.fhirResource.status = "planned";
    return this.fhirResource;
  }

  getPractitionerReference() {
    this.encounterObj.practitionerId =
      this.fhirResource?.participant?.[0]?.individual?.reference?.split("/")[1] || null;
  }
  
  getPrimaryEncounterReference() {
    this.encounterObj.primaryEncounterId =
      this.fhirResource?.partOf?.reference?.split("/")[1] || null;
  }

  getFHIRToTransformedResult() {
    this.encounterObj.labFhirId = this.fhirResource.id;
    return this.getCommonTransformations();
  }
}

module.exports = LabEncounter;
