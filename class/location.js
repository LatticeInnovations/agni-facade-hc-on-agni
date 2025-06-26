class Location {
    locationObj;
    fhirResource;

    constructor(location_obj, fhir_resource) {
        this.locationObj = location_obj;
        this.fhirResource = fhir_resource;
        this.fhirResource.resourceType = "Location";
    }

    setLocationName() {
        if(this.locationObj.name) {
            this.fhirResource.name = this.locationObj.clinicName;
        }
    }
    setOrganizationReference() {
        if(this.locationObj.orgUUID)
            this.fhirResource.managingOrganization = this.locationObj.orgUUID;
        else if(this.locationObj.orgId)
            this.fhirResource.managingOrganization = "Organization/" + this.locationObj.orgId
    }

    getOrganizationReference() {
        this.locationObj.organization = this.fhirResource.managingOrganization.reference
    }

   setStatus() {
    this.fhirResource.status = "active";
   }

   getStatus() {
    this.locationObj.status = this.fhirResource.status;
   }

   setPosition() {
    this.fhirResource.position = {
        "latitude": this.locationObj.position.latitude,
        "longitude": this.locationObj.position.longitude
    }
   }

   getPosition() {
    this.locationObj.position = {
        "latitude": this.fhirResource.position.latitude,
        "longitude": this.fhirResource.position.longitude
    }
   }
  
   getJsonToFhirTranslator() {
        this.setBasicStructure();
        this.setLocationName();
        this.setOrganizationReference();
        this.setStatus();
        this.setPosition();
    }

    getFHIRToTransformedResult() {
        this.getOrganizationReference();
        this.getStatus();
        this.getPosition();
    }


    getSimplifiedOutput() {
        return this.locationObj;
    }

    getFHIRResource() {
        return this.fhirResource;
    }

    setBasicStructure() {
        this.fhirResource.position = {};
        this.fhirResource.managingOrganization = {};
    }

}


module.exports = Location;