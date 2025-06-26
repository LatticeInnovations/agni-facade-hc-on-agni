const config = require("../config/nodeConfig");
const dispenseStatus = require("../utils/dispenseStatus.json");

class DispenseEncounter {
  dispenseObj;
  fhirResource;
  isMain;
  constructor(dispense_obj, fhir_resource, isMain) {
    this.dispenseObj = dispense_obj;
    this.fhirResource = fhir_resource;
    this.isMain = Boolean(isMain);
    this.fhirResource.resourceType = "Encounter"
    console.info("check the received resource: ",dispense_obj, this.isMain, this.dispenseObj)
  }

  setIdentifier() {
    const identifierId = this.isMain ? this.dispenseObj.mainEncounterUuid : this.dispenseObj.dispenseId
    console.info("identifierIdL ", identifierId, this.isMain)
    this.fhirResource.identifier.push({
      system: config.snUrl,
      value: identifierId
    });
  }

  getId() {
    if(!this.isMain) {
      console.log(this.fhirResource)
      this.dispenseObj.dispenseId = this.fhirResource?.identifier[0]?.value;
      this.dispenseObj.dispenseFhirId = this.fhirResource?.id;
    }

  }

  // setAppointmentEncounterId() {
  //   if(this.dispenseObj.appointmentEncounterId) {
  //     this.fhirResource.extension.push({
  //       "url": "https://hl7.org/fhir/StructureDefinition/encounter-associatedEncounter",
  //        "valueReference": {
  //             "reference": "Encounter/" + this.dispenseObj.appointmentEncounterId
  //         }
  //     })
        
  //   }
  // }

  setStatus() {
    if(this.isMain) {
      console.log("it should not work in sub encounter")
      console.log("check if this is coming to if: ")
      let statusData = dispenseStatus.find(
        (e) => e.statusId == this.dispenseObj?.status
      );
      this.fhirResource.status = statusData?.encounter;
    }
  }

  getStatus() {
    if(this.isMain) {
      let statusData = dispenseStatus.find( (e) => e.encounter == this.fhirResource?.status);
      this.dispenseObj.status = statusData?.statusId;
    }

  }

  setType() {
    console.log("check in type: ", this.isMain); // Check if the value is what you expect
    let code = "pharmacy-service"
    let display = "Pharmacy service"
    if(!this.isMain) {
      code = "dispensing-encounter"
      display = "Dispensing encounter"
    }
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
    console.log("check type: ", this.fhirResource.type[0].coding[0])
  }
  getType() {
    if(!this.isMain)
      this.dispenseObj.type = this.fhirResource?.type[0]?.coding[0]?.code;
  }

  setPatientReference() {
    this.fhirResource.subject.reference =
      "Patient/" + this.dispenseObj?.patientId;
  }

  setPartOf() {
    if(this.dispenseObj.prescriptionFhirId || this.dispenseObj.mainEnounterId )
        this.fhirResource.partOf = {
          reference: this.isMain ? "Encounter/" + this.dispenseObj.prescriptionFhirId : (this.dispenseObj.mainEnounterId),
        };
  }

  getPartOf() {
    if(this.isMain && this.fhirResource?.partOf)
      this.dispenseObj.prescriptionFhirId = this.fhirResource?.partOf?.reference.split("/")[1]
  }

  setNote() {
    if (!this.isMain) {
      this.fhirResource.extension.push(
        {
          "url": "https://hl7.org/fhir/StructureDefinition/encounter-note",
          "valueString": this.dispenseObj?.note
        }
      );
    }
  }

  getNote() {
    if(!this.isMain && this.fhirResource.extension) {
      const filteredData = this.fhirResource.extension.filter(e => e.url == "https://hl7.org/fhir/StructureDefinition/encounter-note")
      this.dispenseObj.note = filteredData[0]?.valueString ? filteredData[0].valueString :null
    }
     
  }

  getPatientReference() {
    this.dispenseObj.patientId =
      this.fhirResource.subject.reference.split("/")[1];
  }

  setEncounterTime() {
    if (this.dispenseObj.generatedOn) {
      this.fhirResource.period = {
        start: this.dispenseObj.generatedOn,
        end: this.dispenseObj.generatedOn,
      };
    }
  }

  getEncounterTime() {
    if (this.fhirResource.period && !this.isMain)
      this.dispenseObj.generatedOn = this.fhirResource.period.start;
  }

  getJsonToFhirTranslator() {
    this.setBasicStructure();
    this.setIdentifier();
    this.setPatientReference();
    this.setPartOf()
    this.setType()
    this.setEncounterTime();
    this.setStatus();
    this.setNote()
    // this.setAppointmentEncounterId();
  }

  getFHIRToTransformedResult() {
    this.getId();
    this.getPatientReference();
    this.getEncounterTime();
    this.getStatus()
    this.getType()
    this.getNote()
    this.getPartOf()
  }

  getSimplifiedOutput() {
    return this.dispenseObj;
  }

  getFHIRResource() {
    return this.fhirResource;
  }

  setBasicStructure() {
    this.fhirResource.identifier = [];
    this.fhirResource.subject = {};
    this.fhirResource.note = [];
    this.fhirResource.extension = []
  }
}

module.exports = DispenseEncounter;