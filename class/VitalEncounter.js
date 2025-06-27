const BaseEncounter = require('./BaseEncounter');
const config = require("../config/nodeConfig");

class VitalEncounter extends BaseEncounter {
  constructor(encounterObj, fhirResource) {
    super(encounterObj, fhirResource);
  }

  setBasicStructure() {    
    this.setBasicStructure();
    this.fhirResource.type = [{
      coding: [{
        system: "https://your-custom-coding-system",
        code: "vital-encounter",
        display: "Vital encounter"
      }]
    }];
    this.fhirResource.identifier.push({
      system: config.snUrl + '/vital',
      value: this.encounterObj.vitalUuid
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

  getVitalUuid() {
    this.encounterObj.vitalUuid = this?.fhirResource?.identifier?.[this?.fhirResource?.identifier?.length - 1]?.value || null;
}

  getFHIRToTransformedResult() {
    this.encounterObj.vitalFhirId = this.fhirResource.id;
    this.encounterObj.vitalUuid = this.fhirResource.identifier?.at(-1)?.value || null;
    return this.getCommonTransformations();
  }
}

module.exports = VitalEncounter;
