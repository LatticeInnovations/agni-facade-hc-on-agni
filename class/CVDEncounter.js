const BaseEncounter = require('./BaseEncounter');
const config = require("../config/nodeConfig");

class CVDEncounter extends BaseEncounter {
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
            code: "cvd-encounter",
            display: "CVD encounter"
          }
        ]
      }
    ];

    this.fhirResource.identifier.push({
      system: config.snUrl + '/CVD',
      value: this.encounterObj.cvdUuid
    });

    this.fhirResource.length = {
      value: new Date().valueOf(),
      unit: "millisecond",
      system: "https://unitsofmeasure.org",
      code: "ms"
    };

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
    this.encounterObj.cvdFhirId = this.fhirResource.id;
    this.encounterObj.cvdUuid =
      this.fhirResource?.identifier?.at(-1)?.value || null;
    return this.getCommonTransformations();
  }
}

module.exports = CVDEncounter;
