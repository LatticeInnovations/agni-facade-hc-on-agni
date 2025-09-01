const Organization = require("./Organization");
const urlList = require("../utils/heartcareSystemUrl");

class FacilityOrganization extends Organization {
  constructor(orgObj, fhirResource) {
    super(orgObj, fhirResource);
  }

  setBasicStructure() {
    this.fhirResource.identifier = [];
    this.fhirResource.type = [];
    this.fhirResource.alias = [];
    this.fhirResource.partOf = {};
    this.fhirResource.extension = [];
  }

  setIdentifier() {
    this.fhirResource.identifier = [
      {
        system: urlList.adminDivisionCodeUrl,
        value: this.orgObj.code,
      },
      {
        system: urlList.heartcareAdminUrl,
        value: this.orgObj.heartcareId,
      }
    ];
  }

  setOrgName() {
    if (this.orgObj.name) {
      this.fhirResource.name = this.orgObj.name;
    }
  }

  setAliasName() {
    if (this.orgObj.secondaryName) {
      this.fhirResource.alias = [this.orgObj.secondaryName];
    }
  }

  setPopulation() {
    this.fhirResource.extension.push({
      url: urlList.adminDivisionPopulationUrl,
      valueInteger: this.orgObj?.population || null,
    });
  }

  setLocation() {
    this.fhirResource.extension.push({
      url: urlList.locationReferenceUrl,
      valueReference: {
        reference: "Location/" + +this.orgObj?.precedingLevelId || null,
      },
    });
  }

  setTypeAndDescription() {
    this.fhirResource.type = [
      {
        coding: [
          {
            system: urlList.adminDivisionUrl,
            code: this.orgObj.levelType,
          },
        ],
      },
    ];
    this.fhirResource.description = this.orgObj.levelType;
  }

 
  setStatus() {
    this.fhirResource.status = "active";
  }

   getIdentifier() {
        this.orgObj.healthFacilityId = this.fhirResource.id;
          this.orgObj.code = this.fhirResource.identifier?.[0]?.value
          this.orgObj.heartcareId = this.fhirResource.identifier?.[1]?.value
      }
  
      getOrgName() {
        console.log(this.fhirResource)
        this.orgObj.name = this.fhirResource.name;
      }
  
      getTypeAndDescription() {
          if(this.fhirResource.description) {
              this.orgObj.levelType = this.fhirResource.description
          }
      }
  
      
      getOrganizationReference() {
          this.orgObj.organization = this.fhirResource.managingOrganization.reference
      }
  
  
  
     getStatus() {
      this.orgObj.status = this.fhirResource.status;
     }
  
     getPopulation () {
      const data = this.fhirResource.extension.find(e => e.url === urlList.adminDivisionPopulationUrl)
      this.orgObj.population = data?.[0]?.valueInteger || null
     }

     getLocation() {
        const data = this.fhirResource.extension.find(e => e.url === urlList.locationReferenceUrl)
      this.orgObj.islandId = data?.valueReference?.reference.split("/")[1] || null
     }

  
     getAliasName() {
      this.orgObj.secondaryName = this.fhirResource?.alias?.[0] || null
     }
    
     getJsonToFhirTranslator() {
          this.setBasicStructure();
          this.setIdentifier();
          this.setOrgName();
          this.setAliasName();
          this.setPopulation();
          this.setLocation();
          this.setTypeAndDescription();
          this.setStatus();
      }
  
      getFHIRToTransformedResult() {
          this.getOrgName();
          this.getIdentifier();
          this.getTypeAndDescription();
          // this.getPopulation();
          // this.getAliasName();
          // this.getStatus();
          this.getLocation();
      }

      getSimplifiedOutput() {
        return this.orgObj
      }
    
      getFHIRResource() {
        return this.fhirResource
      }
  
  
}

module.exports = FacilityOrganization;
