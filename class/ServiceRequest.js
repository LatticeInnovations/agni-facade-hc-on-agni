
const { identifierUrl } = require("../utils/heartcareSystemUrl");
class ServiceRequest {

    constructor(requestObj, fhir_resource) {
        this.requestObj = requestObj;
        this.fhirResource = fhir_resource;
        this.fhirResource.resourceType = "ServiceRequest";

    }
   
    setBasicStructure() {
        this.fhirResource.identifier = [];
        this.fhirResource.instantiatesCanonical = []
        this.fhirResource.status = "active"
        this.fhirResource.category = [{
            "coding": [
              {
                "system": " http://snomed.info/sct",
                "code": this.requestObj.categoryCode,
                "display": this.requestObj.categoryDisplay
              }
            ]
          }];
          this.fhirResource.code = []
          this.fhirResource.encounter = {}
          this.fhirResource.subject = {}
          this,this.fhirResource.requester = {}
    }

    setEncounterId() {
        this.fhirResource.encounter = {
            "reference": "Encounter/" + this.requestObj.encounterId
        }
    }

    setSubject() {
        this.fhirResource.subject.reference = "Patient/" + this.requestObj.patientId;
    }

    setPractitionerId() {
        this.fhirResource.requester.reference = "Practitioner/" + this.requestObj.practitionerId;
    }

    getIdentifier() {
      this.requestObj.uuid = this.fhirResource.identifier?.[0]?.value || null;
   }

   setOccurrenceDate() {
    this.fhirResource.occurrenceDateTime = this.requestObj.appUpdatedDate
   }

   setIdentifier() {
    this.fhirResource.identifier = [
        {
            "system": identifierUrl,
            value: this.requestObj.uuid
        }
    ]
   }

   setInitiatesCanonical() {
    this.fhirResource.instantiatesCanonical = this.requestObj?.activityList || null
   }

   getInitiatesCanonical() {
    this.requestObj.activityList = this.fhirResource?.instantiatesCanonical?.map(element => element.split("/")[1]) ?? null
   }

    getId() {
      this.requestObj.fhirId = this.fhirResource.id
    }

    getGeneratedOn() {
      this.requestObj.appUpdatedDate = this?.fhirResource?.occurrenceDateTime || null;
   }

   getEncounter() {
    this.requestObj.encounterId = this.fhirResource.encounter.reference
   }

   getPatientId() {
      this.requestObj.patientId = this.fhirResource.subject.reference.split("/")[1]
   }

   getPractitionerId() {
      this.requestObj.practitionerId = this.fhirResource.requester.reference.split("/")[1]
   }

    getJsonToFhirTranslator() {
        this.setBasicStructure();
        this.setIdentifier();
        this.setEncounterId();
        this.setSubject();
        this.setPractitionerId();
        this.setOccurrenceDate(); 
        this.setInitiatesCanonical();
    }

    getFHIRToTransformedResult() {
      this.getId();
      this.getGeneratedOn();
      this.getIdentifier();
      this.getPatientId();
      // this.getEncounter();
      this.getPractitionerId();
      this.getInitiatesCanonical();
  }
  getSimplifiedOutput() {
    return this.requestObj
  }

  getFHIRResource() {
    return this.fhirResource
  }
}

module.exports = ServiceRequest