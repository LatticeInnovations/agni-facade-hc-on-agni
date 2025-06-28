const BaseEncounter = require('./BaseEncounter');
const config = require("../config/nodeConfig");

class VitalEncounter extends BaseEncounter {
  constructor(encounterObj, fhirResource) {
    super(encounterObj, fhirResource);
  }

  setBasicVitalStructure() {  
    this.setPartOf();
    this.fhirResource.type = [{
      coding: [{
        system: "https://your-custom-coding-system",
        code: "vital-encounter",
        display: "Vital encounter"
      }]
    }];
    this.fhirResource.identifier.push({
      system: config.snUrl + '/vital',
      value: this.encounterObj.id
    });
    this.fhirResource.length = {
      value: new Date().valueOf(),
      unit: "millisecond",
      system: "https://unitsofmeasure.org",
      code: "ms"
    };
  }

  getJsonToFhirTranslator() {
    super.getJsonToFhirTranslator();
    this.setBasicVitalStructure();

  }


  getPractitionerReference() {
    this.encounterObj.practitionerId =
      this.fhirResource?.participant?.[0]?.individual?.reference?.split("/")[1] || null;
  }



  getFHIRToTransformedResult() {
    super.getFHIRToTransformedResult();
    this.getPrimaryEncounterReference();
    this.encounterObj.vitalFhirId = this.fhirResource.id;
    this.encounterObj.vitalUuid = this.fhirResource.identifier?.at(-1)?.value || null;
  }


}

module.exports = VitalEncounter;
