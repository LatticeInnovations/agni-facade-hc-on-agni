let { checkEmptyData } = require("../services/CheckEmpty");
const config = require("../config/nodeConfig");
const { v4: uuidv4 } = require("uuid");
class MedicationDispense {
  medDispenseObj;
  fhirResource;

  constructor(med_dispense_obj, fhir_resource) {
    this.medDispenseObj = med_dispense_obj;
    this.fhirResource = fhir_resource;
    this.fhirResource.resourceType = "MedicationDispense"
  }

  setIdentifierJSON(element) {
    let jsonObj = {};
    if (!checkEmptyData(element.code)) {
      jsonObj = {
        type: {
          coding: [
            {
              system: config.fhirCodeUrl,
              code: element.code,
            },
          ],
        },
        system: element.identifierType,
        value: element.identifierNumber,
      };
    } else {
      jsonObj = {
        value: element.identifierNumber,
        system: element.identifierType,
      };
    }
    return jsonObj;
  }

  setIdentifier() {
    this.fhirResource.identifier = [this.setIdentifierJSON({
      identifierType: "https://www.thelattice.in/",
      identifierNumber:  this.medDispenseObj.medDispenseUuid,
      code: "MR",
    })]
  }

  getIdentifier() {
    if(this.fhirResource.identifier)
      this.medDispenseObj.medDispenseUuid = this.fhirResource.identifier[0].value;
  }

  getId() {
    this.medDispenseObj.medDispenseFhirId =
      this.fhirResource.id;
  }

  setMedication() {
    this.fhirResource.medicationReference.reference =
      "Medication/" + this.medDispenseObj.medFhirId;
  }

  setPatientReference() {
    this.fhirResource.subject.reference =
      "Patient/" + this.medDispenseObj.patientId;
  }

  getPatientReference() {
    this.medDispenseObj.patientId =
      this.fhirResource.subject.reference.split("/")[1];
  }

  setEncounter() {
    // Sub encounter i.e dispensing-encounter Encounter to maintain date of recording
    this.fhirResource.context.reference =
      "urn:uuid:" + this.medDispenseObj.subEncounterId;
  }

  setMedicationRequestId() {
    if(this.medDispenseObj.category != "OTC") {
        this.fhirResource.authorizingPrescription = [
            {
              reference: "MedicationRequest/" + this.medDispenseObj.medReqFhirId,
            },
          ];
        }
    }


  getMedicationRequestId() {
    if(this.fhirResource.authorizingPrescription)
      this.medDispenseObj.medReqFhirId = this.fhirResource?.authorizingPrescription[0]?.reference.split("/")[1];
  }

  setDispenseQuantityDetail() {
    this.fhirResource.quantity = {
      value: this.medDispenseObj.qtyDispensed
    };
  }

  getDispenseQuantityDetail() {
    this.medDispenseObj.qtyDispensed = this.fhirResource.quantity?.value
  }

  setMedicationDetail() {
    this.fhirResource.medicationReference.reference =
    "Medication/" + this.medDispenseObj.medFhirId;
  }

  getMedicationDetail() {
    this.medDispenseObj.medFhirId =
      this.fhirResource.medicationReference.reference.split("/")[1];
  }

  setMedHandoverTime() {
    this.fhirResource.whenHandedOver = this.medDispenseObj.date;
  }

  getMedHandoverDetail() {
    this.medDispenseObj.date = this.fhirResource.whenHandedOver;
  }

  setMedicationDispenseCategory() {
    this.fhirResource.category = {
      coding: [
        {
          "system": "https://your-custom-coding-system",
          code: this.medDispenseObj?.category,
        },
      ],
    };
  }

  getMedicationDispenseCategory() {
    this.medDispenseObj.category = this.fhirResource?.category?.coding[0]?.code;
  }

  setSubstitution() {
    this.fhirResource.substitution = {
      wasSubstituted: this.medDispenseObj.isModified
    }
    if (this.medDispenseObj.isModified)
      this.fhirResource.substitution.reason = [
    {
      "coding": [
        {
          "system": "https://terminology.hl7.org/CodeSystem/v3-ActReason",
          "code": this.medDispenseObj.modificationType
        }
      ]
    }
    ]
  }

  getSubstitution() {
    this.medDispenseObj.isModified = this.fhirResource?.substitution?.wasSubstituted ?? false
    if(this.medDispenseObj.isModified)
      this.medDispenseObj.modificationType = this.fhirResource.substitution.reason[0].coding[0].code

  }
  setMedicationDispenseNote() {
    if (this.medDispenseObj.medNote) {
        this.fhirResource.note = [
            {
              authorString: this.medDispenseObj?.medNote,
            },
          ];
    }

  }
  getMedicationDispenseNote() {
    if(this.fhirResource.note)
      this.medDispenseObj.medNote = this.fhirResource?.note[0]?.authorString;
    else
      this.medDispenseObj.medNote = null
  }

  setBasicStructure() {
    // this.fhirResource.dosageInstruction = [];
    this.fhirResource.medicationReference = {};
    this.fhirResource.subject = {};
    this.fhirResource.context = {};
    this.fhirResource.identifier = [];
  }

  getJsonToFhirTranslator() {
    this.setBasicStructure();
    this.setIdentifier();
    this.setPatientReference();
    this.setEncounter();
    this.setDispenseQuantityDetail();
    this.setMedicationDetail();
    this.setMedicationRequestId();
    this.setMedHandoverTime();
    this.setMedicationDispenseCategory();
    this.setSubstitution();
    this.setMedicationDispenseNote();
  }

  getFHIRResource() {
    return this.fhirResource;
  }

  getFHIRToTransformedResult() {
    this.getId();
    this.getIdentifier();
    this.getPatientReference();
    this.getDispenseQuantityDetail();
    this.getMedicationDetail();
    this.getMedicationRequestId();
    this.getMedHandoverDetail();
    this.getMedicationDispenseCategory();
    this.getSubstitution();
    this.getMedicationDispenseNote();
    return this.medDispenseObj;
  }

  getSimplifiedOutput() {
    return this.medDispenseObj;
  }

}

module.exports = MedicationDispense;