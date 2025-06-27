let apptStatus = require("../utils/appointmentStatus.json");
const config = require("../config/nodeConfig")

class BaseEncounter {
  constructor(encounterObj, fhirResource) {
    this.encounterObj = encounterObj;
    this.fhirResource = fhirResource;
    this.fhirResource.resourceType = "Encounter"
  }

  setBasicStructure() {
    this.fhirResource.identifier = [];
    this.fhirResource.subject = {};
    this.fhirResource.appointment = {};
    this.fhirResource.serviceProvider = {}
  }

  setUuid() {
    console.log("encounter obj: ", this.encounterObj)
    if(this.encounterObj.uuid)
      this.fhirResource.identifier.push({
            "system": config.snUrl,
            "value": this.encounterObj.uuid
      });
      console.log("The identifier set is: ", this.fhirResource.identifier)
  }

  setStatus() {
    //  changed for anni for school planned apptStatus
    let statusData = apptStatus.find(e => e.uiStatus == this.encounterObj.status);
    this.fhirResource.status = statusData.encounter;
}

  getId() {
      this.encounterObj.appointmentUuid = this.fhirResource?.identifier[0]?.value;
  }

  setPatientReference() {
    this.fhirResource.subject.reference =
      "Patient/" + this.encounterObj.patientId;
  }

  setOrganizationReference() {
    this.fhirResource.serviceProvider.reference =
      "Organization/" + this.encounterObj.orgId;
  }

  setAppointmentReference() {
    this.fhirResource.appointment.reference = "urn:uuid:" + this.encounterObj.uuid;
}

  getAppointmentReference() {
      this.encounterObj.appointmentId = this?.fhirResource?.appointment?.[0]?.reference?.split("/")[1] || null;
  }

  setEncounterTime() {
    if(this.encounterObj.generatedOn) {
        this.fhirResource.period = {
            "start": this.encounterObj.generatedOn,
            "end": this.encounterObj.generatedOn
        }
    }

}

getEncounterTime() {
    if(this.fhirResource.period)
    this.encounterObj.generatedOn = this.fhirResource.period.start;
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
  }

  getSimplifiedOutput() {
    return this.encounterObj;
  }

  getFHIRResource() {
    return this.fhirResource;
  }


  setSubEncounterStructure() {
    this.fhirResource.id = this.encounterObj.id;
    this.fhirResource.identifier = [];
    this.fhirResource.subject = {};
    this.fhirResource.serviceProvider = {};
    this.fhirResource.period = {
      start: this.encounterObj.createdOn,
      end: this.encounterObj.createdOn,
    };
    this.fhirResource.partOf = {
      reference: "Encounter/" + this.encounterObj.encounterId,
      display: "Primary Encounter",
    };
    this.fhirResource.participant = [
      {
        individual: {
          reference: "Practitioner/" + this.encounterObj.practitionerId,
        },
      },
    ];
  }

  deleteEncounter() {
    this.fhirResource.status = "entered-in-error";
    return this.fhirResource;
  }


}

module.exports = BaseEncounter;
