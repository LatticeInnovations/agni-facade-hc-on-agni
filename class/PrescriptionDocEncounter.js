const BaseEncounter = require('./BaseEncounter');
const config = require("../config/nodeConfig");

class PrescriptionDocEncounter extends BaseEncounter {
  constructor(encounterObj, fhirResource) {
    super(encounterObj, fhirResource);
  }

  getJsonToFhirTranslator() {
    super.getJsonToFhirTranslator();
    this.setBasicPrescriptionDocStructure();

  }


  getPractitionerReference() {
    this.encounterObj.practitionerId =
      this.fhirResource?.participant?.[0]?.individual?.reference?.split("/")[1] || null;
  }

  setBasicPrescriptionDocStructure() {
    this.setPartOf();
    this.fhirResource.type = [
        {
            "coding": [
                        {
                            "system": "https://your-custom-coding-system",
                            "code": "prescription-encounter-document",
                            "display": "Prescription document encounter"
                        }
                    ]
        }
    ];

    this.fhirResource.identifier.push({
        "system": config.snUrl + '/prescriptionDocument',
        "value": this.encounterObj.prescriptionId
    });
    this.fhirResource.status = 'planned';
}

deletePrescriptionDocument(){
    this.fhirResource.status = "entered-in-error";
    return this.fhirResource;
}


}

module.exports = PrescriptionDocEncounter;
