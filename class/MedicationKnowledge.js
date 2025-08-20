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
                classification: [{
                    coding: [
                        {
                            system: "http://heartcare.org",
                            code: this.medKnowledgeObj.classId,
                            display: this.medKnowledgeObj.className
                        }
                    ]
                }]
               
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

    getData() {
        this.medKnowledgeObj.categoryId = this.fhirResource.productType[0].coding[0].code
        this.medKnowledgeObj.categoryName = this.fhirResource.productType[0].coding[0].display
        this.medKnowledgeObj.classId = this.fhirResource.medicineClassification?.[0]?.classification?.[0]?.coding?.[0]?.code || null
        this.medKnowledgeObj.className = this.fhirResource.medicineClassification?.[0]?.classification?.[0]?.coding?.[0]?.display || null
        this.medKnowledgeObj.brandName = this.fhirResource?.synonym?.[0] || null
    }
    
    getJsonToFhirTranslator() {
        this.setData();
    }
    getFHIRToTransformedResult() {
      this.getData();
    }

    getSimplifiedOutput() {

        return this.medKnowledgeObj;
    }

    getFHIRResource() {
        return this.fhirResource
    }
}


module.exports = MedicationKnowledge;