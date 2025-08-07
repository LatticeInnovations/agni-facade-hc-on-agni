let { checkEmptyData } = require("../services/CheckEmpty");


class MedicationKnowledge {
    medKnowledgeObj;
    fhirResource;
    reqType;
    constructor(medKnowledgeObj, fhir_resource) {
        this.medKnowledgeObj = medKnowledgeObj;
        this.fhirResource = fhir_resource;
        this.fhirResource.resourceType = "MedicationKnowledge"
    }

    setData() {
            this.fhirResource.synonym = this.medKnowledgeObj?.brandName || null,
            this.fhirResource.productType = [{
                coding: {
                    system: "http://heartcare.org",
                    code: this.medKnowledgeObj.categoryId,
                    display: this.medKnowledgeObj.categoryName
                }
            }];
            this.fhirResource.medicineClassification = [{
                system: "http://heartcare.org",
                    code: this.medKnowledgeObj.classId,
                    display: this.medKnowledgeObj.className
            }];
            this.fhirResource.associatedMedication = [{
                reference: this.medKnowledgeObj.medicineId
            }],
            this.fhirResource.code = [
                {
                    coding: [
                        {
                            system: "http://heartcare.org",
                            code:   this.medKnowledgeObj.code,
                            display:  `${this.medKnowledgeObj.name} ${this.medKnowledgeObj.dosage} mg tablet`
                          }
                    ]
                }
            ]
    }
    
    getJsonToFhirTranslator() {
        this.setData();
    }
    getFHIRToTransformedResult() {
      
    }

    getSimplifiedOutput() {
        return this.medicineObj;
    }

    getFHIRResource() {
        return this.fhirResource
    }
}


module.exports = MedicationKnowledge;