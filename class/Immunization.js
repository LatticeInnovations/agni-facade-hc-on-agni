let { checkEmptyData } = require("../services/CheckEmpty");
let vaccineList = require("../utils/vaccines.json")
class Immunization {
  immunizationObj;
  fhirResource;

  constructor(immunization_req_obj, fhir_resource) {
    this.immunizationObj = immunization_req_obj;
    this.fhirResource = fhir_resource;
  }

  setIdentifier() {
    this.fhirResource.identifier = this.immunizationObj.identifier;
  }
  getIdentifier() {
    this.immunizationObj.identifier = this.fhirResource.identifier;
  }

  getimmunizationFhirId() {
    this.immunizationObj.immunizationId =this.fhirResource.id
  }

  getId() {
    if (this.fhirResource.identifier) {
      this.immunizationObj.immunizationUuid =
        this.fhirResource.identifier[0].value;
    }
  }

  setVaccineCode() {
    const vaccineData = vaccineList[this.immunizationObj.vaccineCode] ||  null
    this.fhirResource.vaccineCode.coding[0].code = this.immunizationObj.vaccineCode;
    this.fhirResource.vaccineCode.coding[0].display = vaccineData.text;
    this.fhirResource.vaccineCode.text = vaccineData.display;
  }

  getVaccineCode() {
    this.immunizationObj.vaccineCode = this.fhirResource.vaccineCode.coding[0].code
  }

  setLotNumber() {
    this.fhirResource.lotNumber = this.immunizationObj.lotNumber
  }

  getLotNumber() {
    this.immunizationObj.lotNumber = this.fhirResource.lotNumber
  }

  setManufacturer() {
    if(!checkEmptyData(this.immunizationObj.manufacturerId))
        this.fhirResource.manufacturer.reference = "Organization/" + this.immunizationObj.manufacturerId
  }

  getManufacturer() {
    if(!checkEmptyData(this.fhirResource.manufacturer))
        this.immunizationObj.manufacturerId = this.fhirResource.manufacturer.reference.split("/")[1];
    else
    this.immunizationObj.manufacturerId = null
  }

  setOccuranceTime() {
    this.fhirResource.occurrenceDateTime = this.immunizationObj.createdOn
  }

  getOccuranceTime() {
    this.immunizationObj.createdOn = this.fhirResource.occurrenceDateTime;
  }

  setExpiryDate() {
    this.fhirResource.expirationDate = this.immunizationObj.expiryDate;
  }

  getExpiryDate() {
    this.immunizationObj.expiryDate = this.fhirResource.expirationDate;
  }

  setPatientReference() {
    this.fhirResource.patient.reference =
      "Patient/" + this.immunizationObj.patientId;
  }

  getPatientReference() {
    this.immunizationObj.patientId =
      this.fhirResource.patient.reference.split("/")[1];
  }

  setSubEncounter() {
    this.fhirResource.encounter.reference =
      "urn:uuid:" + this.immunizationObj.subEncounterId;
  }

  getSubEncounter() {
    this.immunizationObj.subEncounterId = this.fhirResource.encounter.reference.split("/")[1]
  }

  setNotes() {
    if (!checkEmptyData(this.immunizationObj.notes)) {
      this.fhirResource.note.push({ text: this.immunizationObj.notes });
    }
  }

  getNotes() {
    if (!checkEmptyData(this.fhirResource.note)) {
      this.immunizationObj.notes = this.fhirResource.note[0].text;
    } else {
      this.immunizationObj.notes = null;
    }
  }

  setPerformer() {
    this.fhirResource.performer[0].actor.reference = "Practitioner/" + this.immunizationObj.practitionerId;
  }

  setBasicStructure() {
    this.fhirResource.resourceType = "Immunization"
    this.fhirResource.vaccineCode = {
      coding: [
        {
          system: "urn:oid:1.2.36.1.2001.1005.17",
          code: "",
        },
      ],
      text: ""
    };
    this.fhirResource.encounter = {};
    this.fhirResource.note = [];
    this.fhirResource.patient = {}
    this.fhirResource.identifier = [];
    this.fhirResource.status = "completed";
    this.fhirResource.primarySource = true;
    this.fhirResource.performer = [
        {
            "actor": {
                "reference": ""
            }
        }
    ]
    this.fhirResource.manufacturer = {
        "reference" : ""
    }
  }

  getJsonToFhirTranslator() {
    this.setBasicStructure();
    this.setIdentifier();
    this.setVaccineCode();
    this.setLotNumber();
    this.setManufacturer();
    this.setPatientReference();
    this.setSubEncounter();
    this.setNotes();
    this.setOccuranceTime();
    this.setExpiryDate();
    this.setPerformer();
  }

  getFHIRResource() {
    return this.fhirResource;
  }

  getImmunizationObj() {
    this.getId();
    this.getimmunizationFhirId();
    this.getVaccineCode();
    this.getNotes();
    this.getLotNumber();
    this.getManufacturer();
    this.getSubEncounter();
    this.getExpiryDate();
    this.getOccuranceTime();
    this.getPatientReference();
  }

  getSimplifiedOutput() {
    return this.immunizationObj;
  }

}

module.exports = Immunization;
