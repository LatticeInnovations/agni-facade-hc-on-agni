let apptStatus = require("../utils/appointmentStatus.json");
const config = require("../config/nodeConfig")

class BaseEncounter {
  constructor(encounterObj, fhirResource) {
    this.encounterObj = encounterObj;
    this.fhirResource = fhirResource;
    this.fhirResource.resourceType = "Encounter";
  }

  setBasicStructure() {
    this.fhirResource.identifier = [];
    this.fhirResource.subject = {};
    this.fhirResource.appointment = {};
    this.fhirResource.serviceProvider = {};
  }

  setUuid() {
    if (this.encounterObj.uuid) {
      this.fhirResource.identifier.push({
        system: config.snUrl,
        value: this.encounterObj.uuid,
      });
    }
  }

  setStatus() {
    if (this.encounterObj.status) {
      let statusData = apptStatus.find(
        (e) => e.uiStatus == this.encounterObj.status
      );
      this.fhirResource.status = statusData.encounter;
    }
  }

  setType() {
    this.fhirResource.type = [
      {
        "coding": [
          {
              "system": "https://your-custom-coding-system",
              "code": this.encounterObj.encounterType,
              "display": this.encounterObj.encounterType,
          }
      ]
      }
    ]
  }

  getId() {
    this.encounterObj.appointmentUuid = this.fhirResource?.identifier[0]?.value;
  }

  setAppointmentReference() {
    if(this.encounterObj.uuid) {
          this.fhirResource.appointment.reference = "urn:uuid:" + this.encounterObj.uuid;
    }

}

setPartOf () {
  this.fhirResource.partOf = {
    "reference": "Encounter/" + this.encounterObj.encounterId,
    "display": "Primary Encounter"
  }
}
setParticipant() {
  this.fhirResource.participant = [{
      "individual" : {
          "reference": "Practitioner/" + this.encounterObj.practitionerId
      }
  }, {
    "individual" : {
      "reference": "PractitionerRole/" + this.encounterObj.roleId
  }
  }];
}


  getAppointmentReference() {
      this.encounterObj.appointmentId = this?.fhirResource?.appointment?.[0]?.reference?.split("/")[1] || null;
  }


setPatientReference() {
    this.fhirResource.subject.reference = "Patient/" + this.encounterObj.patientId;
}

setLocationForFacility() {
  console.log("this.encounterObj.patientAddress: ", this.encounterObj.patientAddress)
  // if(!this.encounterObj.isCampaign)
  //   this.fhirResource.location = [
  //     {
  //       location: {
  //         reference: "Location/" + this.encounterObj.patientAddress.state,
  //         display: "province"
  //       }
  //     },
  //     {
  //       location: {
  //         reference: "Location/" + this.encounterObj.patientAddress.city,
  //         display: "area-council"
  //       }
  //     },
  //     {
  //       location: {
  //         reference: "Location/" + this.encounterObj.patientAddress.district,
  //         display: "island"
  //       }
  //     }
  //   ];
  //   if(this.encounterObj.patientAddress.line) {
  //     this.fhirResource.location.push({
  //       location: {
  //         reference: "Location/" + this.encounterObj.patientAddress.line[0],
  //         display: "village"
  //       }
  //     })
  //   }
}

setLocationForCampaign() {
  if(this.encounterObj.isCampaign) {
    this.fhirResource.location = [
      {
        location: {
          reference: "Location/" + this.encounterObj.campaignId,
          display: "screening-site-location"
        }
      }
    ]
  }

}

getCampaignId() {
  this.encounterObj.campaignId = this.fhirResource?.location?.[0]?.location?.reference?.split("/")[1] || null
}


setOrganizationReference(){
  if(!this.encounterObj.isCampaign)
    this.fhirResource.serviceProvider.reference = "Organization/" + this.encounterObj.orgId;
}

getPatientReference() {
    this.encounterObj.patientId = this.fhirResource.subject.reference.split("/")[1];
}


  setEncounterTime() {
    if (this.encounterObj.generatedOn) {
      this.fhirResource.period = {
        start: this.encounterObj.generatedOn,
        end: this.encounterObj.generatedOn,
      };
    }
  }

  getEncounterTime() {
    if (this.fhirResource.period)
      this.encounterObj.generatedOn = this.fhirResource.period.start;
  }


  getPractitionerReference() {

    this.encounterObj.practitionerId = this?.fhirResource?.participant?.[0]?.individual?.reference?.split('/')[1] || null;
  }

  getPrimaryEncounterReference() {
      this.encounterObj.primaryEncounterId = this?.fhirResource?.partOf?.reference?.split('/')[1] || null;
  }

  getPractitionerRoleReference() {
    this.encounterObj.roleId = this?.fhirResource?.participant?.[1]?.individual?.reference?.split('/')[1] || null;
  }

  getJsonToFhirTranslator() {
    this.setBasicStructure();
    this.setUuid();
    this.setPatientReference();
    this.setAppointmentReference();
    this.setEncounterTime();
    this.setStatus();
    this.setType();
    this.setParticipant();
    this.setLocationForFacility();
    this.setLocationForCampaign();
    this.setOrganizationReference();
  }

  getFHIRToTransformedResult() {
    this.getId();
    this.getAppointmentReference();
    this.getPatientReference();
    this.getEncounterTime();
    this.getPractitionerRoleReference();
    this.getPractitionerReference();
    this.getCampaignId();
  }

  getSimplifiedOutput() {
    return this.encounterObj;
  }

  getFHIRResource() {
    return this.fhirResource;
  }

  deleteEncounter() {
    this.fhirResource.status = "entered-in-error";
    return this.fhirResource;
  }
}

module.exports = BaseEncounter;
