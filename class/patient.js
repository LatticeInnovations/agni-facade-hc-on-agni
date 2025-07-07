let { checkEmptyData } = require("../services/CheckEmpty");
const Person = require("./person");

class Patient extends Person {
  patient_obj;
  fhir_resource;
  reqType;
  constructor(patient_obj, fhir_resource) {
    super(patient_obj, fhir_resource);
    this.patient_obj = patient_obj;
    this.fhir_resource = fhir_resource;
    this.fhir_resource.resourceType = "Patient"
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

  setDeceased() {
    
  }

  getDeceased() {
    
  }

  getRelationData(relationCode) {
    const relationData = this.fhirResource.contact?.find(e => e.relationship[0].coding[0].code === relationCode) || null
    return relationData
  }
  getMothersName() {
    const relationData = this.getRelationData("MTH")
    this.patient_obj.mothersName = relationData?.name || null;
  }

  getFathersName() {
    const relationData = this.getRelationData("FTH")
    this.patient_obj.fathersName = relationData?.name || null;
  }
  getSpouseName() {
    const relationData = this.getRelationData("SPS")
    this.patient_obj.fathersName = relationData?.name || null;  
  }

  setFhirId() {
    if(this.patient_obj?.fhirId) {
      this.fhir_resource.id = this.patient_obj?.fhirId
    }
  }

  setDeceasedReason() {
    if(this.patient_obj.deceasedReason && this.patient_obj.deceasedReason != null) {
      this.fhirResource.deceasedBoolean = true
    }
    else {
      this.fhirResource.deceasedBoolean = false
    }
  }
  getJsonToFhirTranslator() {
    this.setBasicStructure()
    this.setIdAsIdentifier();
    this.setFirstName();
    this.setMiddleName();
    this.setLastName();
    this.setIdentifier();
    this.setActive();
    this.setGender();
    this.setBirthDate();
    this.setPhone();
    this.setEmailAddress();
    this.setAddress("home");
    this.setAddress("temp");
    this.setManagingOrg();
    this.setGeneralPractitioner();
    this.setMothersName();
    this.setFathersName();
    this.setSpouseName();
}

getFHIRToTransformedResult() {
  this.getId();
  this.getFirstName();
  this.getMiddleName();
  this.getLastName();
  this.getIdentifier();
  this.getActive();
  this.getGender();
  this.getBirthDate();
  this.getPhone();
  this.getEmailAddress();
  this.getAddress();
  this.getManagingOrg();
  this.getGeneralPractitioner();
  this.getMothersName();
  this.getFathersName();
  this.getSpouseName();
}


setPatchData(fetchedResourceData) {
  this.patchFirstName(fetchedResourceData);
  this.patchMiddleName(fetchedResourceData);
  this.patchLastName(fetchedResourceData);
  this.patchIdentifier(fetchedResourceData);
  this.patchActive();
  this.patchGender();
  this.patchBirthDate();
  if(this.personObj.mobileNumber || this.personObj.email)
      this.patchTelecom(fetchedResourceData);
  if(!fetchedResourceData.address) 
      this.addAddress() 
  if (this.personObj["permanentAddress"] !== undefined && fetchedResourceData.address)
      this.patchAddress("home", fetchedResourceData);
  if (this.personObj["tempAddress"] !== undefined && fetchedResourceData.address)
      this.patchAddress("temp", fetchedResourceData);
}

}






module.exports = Patient;