const urlList = require("../utils/heartcareSystemUrl");
class LevelLocation {
    locationObj;
    fhirResource;

    constructor(location_obj, fhir_resource) {
        this.locationObj = location_obj;
        this.fhirResource = fhir_resource;
        this.fhirResource.resourceType = "Location";
    }

    setIdentifier() {
        this.fhirResource.identifier = [
            {
                "system": urlList.adminDivisionCodeUrl,
                "value": this.locationObj.code
            }
        ]
    }

    setLocationName() {
        if(this.locationObj.name) {
            this.fhirResource.name = this.locationObj.name;
        }
    }

    setAliasName() {
        if(this.locationObj.secondaryName) {
            this.fhirResource.alias = [this.locationObj.secondaryName]
        }
    }

    setPopulation() {
        console.log("urlLis: ", urlList)
            this.fhirResource.extension.push(
            {
            "url": urlList.adminDivisionPopulationUrl,
            "valueInteger": this.locationObj?.population || null
            })
    }


    setOrganizationReference() {
        if(this.locationObj.orgId)
            this.fhirResource.managingOrganization = {"reference": "Organization/" + this.locationObj.orgId} 
    }

    setTypeAndDescription() {
            this.fhirResource.type = [
                {
                    "coding": [
                        {
                            "system": urlList.adminDivisionUrl,
                            "code": this.locationObj.levelType
                        }
                    ]
                }
            ]
        this.fhirResource.description = this.locationObj.levelType;
    }

    setPartOf() {
        if(this.locationObj.precedingLevelId)
        this.fhirResource.partOf = {
            "reference": "Location/" + this.locationObj?.precedingLevelId || null
        }
    }

    getPartOf() {
        this.locationObj.precedingLevelId = this.fhirResource?.partOf?.reference?.split("/")[1] || null;
    }

    setStatus() {
        this.fhirResource.status = "active";
       }
    
    getIdentifier() {
        this.locationObj.code = this.fhirResource.identifier?.[0]?.value
    }

    getLocationName() {
       this.locationObj.name = this.fhirResource.name
    }

    getTypeAndDescription() {
        if(this.fhirResource.description) {
            this.locationObj.levelType = this.fhirResource.description
        }
    }

    getFhirId() {
        this.locationObj.fhirId = this.fhirResource.id
    }

    
    getOrganizationReference() {
        this.locationObj.organization = this.fhirResource.managingOrganization.reference
    }



   getStatus() {
    this.locationObj.status = this.fhirResource.status;
   }

   getPopulation () {
    const data = this.fhirResource?.extension?.find(e => e.url === urlList.adminDivisionPopulationUrl) || null
    this.locationObj.population = data?.[0]?.valueInteger || null
   }

   getAliasName() {
    this.locationObj.secondaryName = this.fhirResource?.alias?.[0] || null
   }
  
   getJsonToFhirTranslator() {
        this.setBasicStructure();
        this.setIdentifier();
        this.setLocationName();
        this.setAliasName();
        this.setPopulation();
        this.setPartOf();
        this.setTypeAndDescription();
        this.setOrganizationReference();
        this.setStatus();
    }

    getFHIRToTransformedResult() {
        this.getFhirId();
        this.getLocationName();
        this.getIdentifier();
        this.getTypeAndDescription();
        this.getPopulation();
        this.getAliasName();
        this.getPartOf();
        // this.getOrganizationReference();
        this.getStatus();
    }


    getSimplifiedOutput() {
        return this.locationObj;
    }

    getFHIRResource() {
        return this.fhirResource;
    }

    setBasicStructure() {
        this.fhirResource.managingOrganization = {};
        this.fhirResource.extension = []
    }

    patchLocationName() {
        this.fhirResource.push({"op": "replace", "path": "/name", value: this.locationObj.levelName})
    }
    setPatchData() {
        this.patchLocationName();
    }

}


module.exports = LevelLocation;