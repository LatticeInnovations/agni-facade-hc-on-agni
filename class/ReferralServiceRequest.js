
const { identifierUrl } = require("../utils/heartcareSystemUrl");
class ReferralServiceRequest {

    constructor(requestObj, fhir_resource) {
        this.requestObj = requestObj;
        this.fhirResource = fhir_resource;
        this.fhirResource.resourceType = "ServiceRequest";

    }
   
    setBasicStructure() {
        this.fhirResource.identifier = [];
        this.fhirResource.status = "active"
        this.fhirResource.category = [{
            "coding": [
                {
                    "system": "http://terminology.hl7.org/CodeSystem/servicerequest-category",
                    "code": "referral",
                    "display": "Referral"
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
        this.fhirResource.requester.reference = "PractitionerRole/" + this.requestObj.practitionerRoleId;
    }

    setPerformer() {
        this.fhirResource.performer = [
            {
                "reference": "Organization/" + this.requestObj.healthFacilityId
            }
        ]
    }

    getIdentifier() {
      this.requestObj.uuid = this.fhirResource.identifier?.[0]?.value || null;
   }

   setOccurrenceDate() {
    this.fhirResource.occurrenceDateTime = this.requestObj.appUpdatedDate
   }

   setNote() {
    this.fhirResource.note = [{
        "text": this.requestObj.note
    }];
   }


   setIdentifier() {
    this.fhirResource.identifier = [
        {
            "system": identifierUrl,
            value: this.requestObj.uuid
        }
    ]
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

   getPerformer() {
      this.requestObj.practitionerRoleId = this.fhirResource.requester.reference.split("/")[1]
   }

   getReferredOrg() {
    this.requestObj.healthFacilityId = this.fhirResource.performer[0].reference.split("/")[1]
   }

   getNote() {
    this.requestObj.note = this.fhirResource?.note?.[0]?.text || null;
   }

    getJsonToFhirTranslator() {
        this.setBasicStructure();
        this.setIdentifier();
        this.setEncounterId();
        this.setSubject();
        this.setPractitionerId();
        this.setOccurrenceDate(); 
        this.setPerformer();
        this.setNote();
    }

    getFHIRToTransformedResult() {
      this.getId();
      this.getIdentifier();
      this.getGeneratedOn();
      this.getIdentifier();
      this.getPatientId();
      this.getReferredOrg();
      this.getPerformer();
      this.getNote();
  }
  getSimplifiedOutput() {
    return this.requestObj
  }

  getFHIRResource() {
    return this.fhirResource
  }
}

module.exports = ReferralServiceRequest