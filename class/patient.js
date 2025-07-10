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

  setRelation(relationCode, name) {
    this.fhir_resource.contact.push({
      name:{
        "given": [name]
      }
       ,
      relationship: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
              code: relationCode,
            },
          ],
        },
      ],
    });
  }
  setSpouseName() {
    if (this.patient_obj?.spouseName) {
      this.setRelation("SPS", this.patient_obj?.spouseName)
    }
  }

  setMothersName() {
    if (this.patient_obj?.mothersName) {
      this.setRelation("MTH", this.patient_obj?.mothersName)
    }
  }

  setFathersName() {
    if (this.patient_obj?.fathersName) {
      this.setRelation("FTH", this.patient_obj?.fathersName)
    }
  }

 
  getRelationData(relationCode) {
    const relationData = this.fhirResource.contact?.find(e => e.relationship[0].coding[0].code === relationCode);
    console.log("check relationData: ", relationData, relationCode)
    if(relationData)
      return relationData?.name?.given?.[0]
    return relationData
  }
  getMothersName() {
    const relationData = this.getRelationData("MTH")
    this.patient_obj.mothersName = relationData || null;
  }

  getFathersName() {
    const relationData = this.getRelationData("FTH")
    this.patient_obj.fathersName = relationData || null;
  }
  getSpouseName() {
    const relationData = this.getRelationData("SPS")
    this.patient_obj.spouseName = relationData || null;
  }

  setFhirId() {
    if(this.patient_obj?.fhirId) {
      this.fhir_resource.fhirId = this.patient_obj?.fhirId
    }
  }

  setDeceasedBoolean() {
    if(this.patient_obj.deceasedReason && this.patient_obj.deceasedReason != null) {
      this.fhirResource.deceasedBoolean = true
    }
    else {
      this.fhirResource.deceasedBoolean = false
    }
  }

  // getDeceasedBoolean() {
  // this.patient_obj.deceasedReason  = this.fhirResource.deceasedBoolean 
  // }

  getActive() {
    this.patient_obj.isDeleted = !this.fhirResource.active
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
    this.setDeceasedBoolean();
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
  // this.getDeceasedBoolean();
}
getSimplifiedOutput() {
  return this.patient_obj
}

setPatchData(fetchedResourceData) {
  // this.patchFirstName(fetchedResourceData);
  // this.patchMiddleName(fetchedResourceData);
  // this.patchLastName(fetchedResourceData);
  // this.patchIdentifier(fetchedResourceData);
  this.patchActive();
  // this.patchGender();
  // this.patchBirthDate();
  // if(this.personObj.mobileNumber || this.personObj.email)
  //     this.patchTelecom(fetchedResourceData);
  // if(!fetchedResourceData.address) 
  //     this.addAddress() 
  // if (this.personObj["permanentAddress"] !== undefined && fetchedResourceData.address)
  //     this.patchAddress("home", fetchedResourceData);
  // if (this.personObj["tempAddress"] !== undefined && fetchedResourceData.address)
  //     this.patchAddress("temp", fetchedResourceData);
}

}






module.exports = Patient;