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
    console.log("encounter obj: ", this.encounterObj);
    if (this.encounterObj.uuid) {
      this.fhirResource.identifier.push({
        system: config.snUrl,
        value: this.encounterObj.uuid,
      });
      console.log("The identifier set is: ", this.fhirResource.identifier);
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
  this.fhirResource.participant = [{
      "individual" : {
          "reference": "Practitioner/" + this.encounterObj.practitionerId
      }
  }];

}

  getAppointmentReference() {
      this.encounterObj.appointmentId = this?.fhirResource?.appointment?.[0]?.reference?.split("/")[1] || null;
  }


setPatientReference() {
    this.fhirResource.subject.reference = "Patient/" + this.encounterObj.patientId
}

setOrganizationReference(){
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

  getJsonToFhirTranslator() {
    this.setBasicStructure();
    this.setUuid();
    this.setPatientReference();
    this.setAppointmentReference();
    this.setEncounterTime();
    this.setStatus();
    this.setOrganizationReference();
  }

  getFHIRToTransformedResult() {
    this.getId();
    this.getAppointmentReference();
    this.getPatientReference();
    this.getEncounterTime();
    this.getPractitionerReference();
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
