class CodeSystem {
    codeSystemObj;
    fhirResource;
    reqType;
    constructor(codeSystemObj, fhir_resource, type) {
        this.codeSystemObj = codeSystemObj;
        this.fhirResource = fhir_resource;
        this.reqType = type
    }

    getCode() {
        this.codeSystemObj[this.reqType] = this.fhirResource.concept.map((data) => {
            if(this.reqType == "diagnosis"){
                return {
                    code: data.code,
                    display: data.display,
                    diagnosisId: data.property[0].valueInteger
                }
            }
            // else if(this.reqType == "symptoms"){
            //     let section = data?.extension?.find(d => d.url == "https://www.lattice.in/fhir/StructureDefinition/symptom-section");
            //     let gender = data?.extension?.find(d => d.url == "https://www.lattice.in/fhir/StructureDefinition/gender");
            //     return {
            //         code: data.code,
            //         display: data.display,
            //         type: section ? section?.valueString?.trim() : null,
            //         gender: gender ? gender?.valueCode?.trim() : null 
            //     }
            // }
        });
    }
     getFHIRToJSONOutput() {
        this.getCode();     
        return this.codeSystemObj;
    }

}


module.exports = CodeSystem;