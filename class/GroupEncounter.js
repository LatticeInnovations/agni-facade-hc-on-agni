const config = require("../config/nodeConfig");

class GroupEncounter {
  groupEncounterObj;
  fhirResource;
  isMain;
  constructor(groupEncounter_obj, fhir_resource) {
    this.groupEncounterObj = groupEncounter_obj;
    this.fhirResource = fhir_resource;
    this.fhirResource.resourceType = "Encounter"
  }

  setIdentifier() {
    this.fhirResource.identifier.push({
      system: config.snUrl,
      value: this.groupEncounterObj.uuid
    });
  }

  getId() {
    if(!this.isMain) {
      this.groupEncounterObj.dispenseId = this.fhirResource?.identifier[0]?.value;
      this.groupEncounterObj.dispenseFhirId = this.fhirResource?.id;
    }

  }


  setEncounterTime() {
    if(this.groupEncounterObj.generatedOn) {
        this.fhirResource.period = {
            "start": this.groupEncounterObj.generatedOn,
            "end": this.groupEncounterObj.generatedOn
        }
    }

}

getEncounterTime() {
    if(this.fhirResource.period)
    this.groupEncounterObj.generatedOn = this.fhirResource.period.start;
}

  setType() {
    let code = this.groupEncounterObj.code
    let display = this.groupEncounterObj.display
    this.fhirResource.type = [
      {
        coding: [
          {
            system: "https://your-custom-coding-system",
            code: code,
            display: display
          },
        ],
      },
    ];
  }

  setPatientReference() {
    this.fhirResource.subject.reference =
      "Patient/" + this.groupEncounterObj?.patientId;
  }

  setPartOf() {
    if(this.groupEncounterObj.appointmentEncounterId)
        this.fhirResource.partOf = {
          reference: "Encounter/" + this.groupEncounterObj.appointmentEncounterId
        };
  }

  getPartOf() {
    if(this.isMain && this.fhirResource?.partOf)
      this.groupEncounterObj.appointmentEncounterId = this.fhirResource?.partOf?.reference.split("/")[1]
  }

  getPatientReference() {
    this.groupEncounterObj.patientId =
      this.fhirResource.subject.reference.split("/")[1];
  }

  getPractitionerReference() {
    this.groupEncounterObj.practitionerId = this?.fhirResource?.participant?.[0]?.individual?.reference?.split('/')[1] || null;
  }

  setOrganizationReference(){
    this.fhirResource.serviceProvider.reference = this.groupEncounterObj.orgId ? "Organization/" + this.groupEncounterObj.orgId : null;
}

  setPractitionerReference() {
    if(this.groupEncounterObj.userId) {
      this.fhirResource.participant = [
        {
          "individual": {
            "reference": "Practitioner/" + this.groupEncounterObj.userId
          }
        }
      ]
    }

  }

  getJsonToFhirTranslator() {
    this.setBasicStructure();
    this.setIdentifier();
    this.setPatientReference();
    this.setPartOf();
    this.setType()
    this.setEncounterTime();
    this.setOrganizationReference();
    this.setPractitionerReference();
  }

  getFHIRResource() {
    return this.fhirResource;
  }
  

  getFHIRToTransformedResult() {
    this.getId();
    this.getPatientReference();
    this.getEncounterTime();
    this.getPartOf()
    this.getPractitionerReference();
  }

  getSimplifiedOutput() {
    return this.groupEncounterObj;
  }

  setBasicStructure() {
    this.fhirResource.identifier = [];
    this.fhirResource.subject = {};
    this.fhirResource.serviceProvider = {}
    // this.fhirResource.note = [];
    // this.fhirResource.extension = []
  }


  deleteEncounter(){
    this.fhirResource.status = "entered-in-error";
    return this.fhirResource;
}
 
}

module.exports = GroupEncounter;