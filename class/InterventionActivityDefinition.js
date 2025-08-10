const urlList = require("../utils/heartcareSystemUrl");
class InterventionActivityDefinition {
    interventionObj;
    fhirResource;

    constructor(location_obj, fhir_resource) {
        this.interventionObj = location_obj;
        this.fhirResource = fhir_resource;
        this.fhirResource.resourceType = "ActivityDefinition";
    }


    setTopic() {
        this.fhirResource.topic = [
            {
                coding: [
                    {
                        system: "https://snomedct.org/sct",
                        code: "384758001",
                        display: "intervention"
                    }
                ]
            }
        ]
    }
    setName() {
        if(this.interventionObj.name) {
            this.fhirResource.name = this.interventionObj.name;
            this.fhirResource.title = this.interventionObj.title
        }
    }

    setSecondaryName() {
        if(this.interventionObj.secondaryName) {
            this.fhirResource.subtitle = this.interventionObj?.secondaryName || null;
        }
    }

    setCode() {
            this.fhirResource.code = [
                {
                    coding: [
                        {
                            coding: {
                                code: this.interventionObj.code,
                                display: this.interventionObj.code
                            }
                        }
                    ]
                }
            ]
    }
    setIdentifier() {
        this.fhirResource.identifier = [
            {
                "system": urlList.heartCareIdUrl,
                "value": this.interventionObj.code
            }
        ]
    }


    setStatus() {
        this.fhirResource.status = "active";
       }
    
    getCode() {
        this.interventionObj.code = this.fhirResource.identifier?.[0]?.value || null
        
    }

    getName() {
       this.interventionObj.name = this.fhirResource.name
    }

  
    getFhirId() {
        this.interventionObj.fhirId = this.fhirResource.id
    }

   getStatus() {
    this.interventionObj.status = this.fhirResource.status == "active"? "active": "inactive";
   }


   getSecondaryName() {
    this.interventionObj.secondaryName = this.fhirResource?.subtitle || null
   }
  
   getJsonToFhirTranslator() {
        this.setTopic();
        this.setIdentifier();
        this.setCode();
        this.setName();
        this.setSecondaryName();
        this.setStatus();
    }

    getFHIRToTransformedResult() {
        this.getFhirId();
        this.getName();
        this.getCode();
        this.getSecondaryName();
        this.getStatus();
    }


    getSimplifiedOutput() {
        return this.interventionObj;
    }

    getFHIRResource() {
        return this.fhirResource;
    }

    patchInterventionStatus() {
        this.fhirResource.push({"op": "replace", "path": "/status", value: this.interventionObj.status == "active" ? "active": "retired"})
    }

    setPatchData() {
        this.patchInterventionStatus();
    }

}


module.exports = InterventionActivityDefinition;