const urlList = require("../utils/heartcareSystemUrl");
class TestExamActivityDefinition {
    testExamObj;
    fhirResource;

    constructor(testExamObj, fhir_resource) {
        this.testExamObj = testExamObj;
        this.fhirResource = fhir_resource;
        this.fhirResource.resourceType = "ActivityDefinition";
    }


    setTopic() {
        this.fhirResource.topic = [
            {
                coding: [
                    {
                        system: "https://snomedct.org/sct",
                        code: "43782000",
                        display: "Tests and examinations"
                    }
                ]
            }
        ]
    }
    setName() {
        if(this.testExamObj.name) {
            this.fhirResource.name = this.testExamObj.name;
            this.fhirResource.title = this.testExamObj.title
        }
    }

    setSecondaryName() {
        if(this.testExamObj.secondaryName) {
            this.fhirResource.subtitle = this.testExamObj?.secondaryName || null;
        }
    }

    setCode() {
            this.fhirResource.code = [
                {
                    coding: [
                        {
                            coding: {
                                code: this.testExamObj.code,
                                display: this.testExamObj.code
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
                "value": this.testExamObj.code
            }
        ]
    }


    setStatus() {
        this.fhirResource.status = "active";
       }
    
    getCode() {
        this.testExamObj.code = this.fhirResource.identifier?.[0]?.value || null
        
    }

    getName() {
       this.testExamObj.name = this.fhirResource.name
    }

  
    getFhirId() {
        this.testExamObj.fhirId = this.fhirResource.id
    }

   getStatus() {
    this.testExamObj.status = this.fhirResource.status == "active"? "active": "inactive";
   }


   getSecondaryName() {
    this.testExamObj.secondaryName = this.fhirResource?.subtitle || null
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
        return this.testExamObj;
    }

    getFHIRResource() {
        return this.fhirResource;
    }

    patchInterventionStatus() {
        this.fhirResource.push({"op": "replace", "path": "/status", value: this.testExamObj.status == "active" ? "active": "retired"})
    }

    setPatchData() {
        this.patchInterventionStatus();
    }

}


module.exports = TestExamActivityDefinition;