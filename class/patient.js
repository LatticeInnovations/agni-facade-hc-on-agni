let { checkEmptyData } = require("../services/CheckEmpty");
const Person = require("./person");

class Patient extends Person {
  patient_obj;
  fhir_resource;
  reqType;
  constructor(patient_obj, fhir_resource, token) {
    super(patient_obj, fhir_resource, token);
    this.patient_obj = patient_obj;
    this.fhir_resource = fhir_resource;
    this.fhir_resource.contact = [];
  }

  setPatientLink() {
    if (
      !checkEmptyData(this.patient_obj.relation) &&
      this.patient_obj.relation.length > 0
    )
      this.fhir_resource.link = [];
    this.patient_obj.relation.forEach((element) => {
      this.fhir_resource.link.push({
        other: {
          reference: element.id,
          type: "seealso",
        },
      });
    });
  }

  setSpouseName() {
    if (this.patient_obj?.spouseName) {
      this.fhir_resource.contact.push({
        name: this.patient_obj?.spouseName,
        relationship: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
                code: "SPS",
              },
            ],
          },
        ],
      });
    }
  }

  setMothersName() {
    if (this.patient_obj?.mothersName) {
      this.fhir_resource.contact.push({
        name: this.patient_obj?.mothersName,
        relationship: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
                code: "MTH",
              },
            ],
          },
        ],
      });
    }
  }

  setFathersName() {
    if (this.patient_obj?.fathersName) {
      this.fhir_resource.contact.push({
        name: this.patient_obj?.fathersName,
        relationship: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
                code: "FTH",
              },
            ],
          },
        ],
      });
    }
  }
}


module.exports = Patient;