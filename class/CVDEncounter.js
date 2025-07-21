const BaseEncounter = require('./BaseEncounter');
const config = require("../config/nodeConfig");

class CVDEncounter extends BaseEncounter {
  constructor(encounterObj, fhirResource) {
    super(encounterObj, fhirResource);
  }

  

  setBasicCVDStructure() {
    this.setPartOf();
    this.fhirResource.type = [{
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
      value: this.encounterObj.uuid
    });

    this.fhirResource.length = {
      value: new Date().valueOf(),
      unit: "millisecond",
      system: "https://unitsofmeasure.org",
      code: "ms"
    };
  }

  setOrganizationReference(){
    this.fhirResource.serviceProvider = null;
  }

  setChiefComplaint() {
    this.fhirResource.reasonCode = [
      {
        "coding": [
          {
            "system": "http://snomed.info/sct",
            "code": "422587007",
            "display": "Chief complaint"
          }
        ],
        "text": this.encounterObj?.chiefComplaint || null
      }
    ]
  }
  
  setScreeningDate() {
    this.fhirResource.extension = [
      {
        "url": "http://example.org/fhir/StructureDefinition/screening-date",
        "valueDateTime": this.encounterObj?.screeningDate || null
      }
    ]
  }

  getScreeningDate() {
    this.encounterObj.screeningDate = this.fhirResource.extension?.[0]?.valueDateTime || null
  }

  getChiefComplaint() {
    this.encounterObj.chiefComplaint = this.fhirResource.reasonCode?.[0]?.text || null;
  }

  getJsonToFhirTranslator() {
    super.getJsonToFhirTranslator();
    this.setBasicCVDStructure();
    this.setChiefComplaint();
    this.setScreeningDate();

  }

  getPractitionerReference() {
    this.encounterObj.practitionerId =
      this.fhirResource?.participant?.[0]?.individual?.reference?.split("/")[1] || null;
  }



  getFHIRToTransformedResult() {
    super.getFHIRToTransformedResult();
    this.getPrimaryEncounterReference();
    this.getScreeningDate();
    this.getChiefComplaint()
    this.encounterObj.cvdFhirId = this.fhirResource.id;
    this.encounterObj.uuid = this.fhirResource.identifier?.at(-1)?.value || null;
  }
}

module.exports = CVDEncounter;
