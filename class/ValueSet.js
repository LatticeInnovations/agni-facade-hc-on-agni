class ValueSet {
    valueset_obj;
    fhirResource;
    reqType;
    constructor(valueset_obj, fhir_resource, type) {
        this.valueset_obj = valueset_obj;
        this.fhirResource = fhir_resource;
        this.reqType = type
    }

    getCode() {
        this.valueset_obj[this.reqType] = this.fhirResource.concept.map((data) => {
            if(this.reqType == "diagnosis"){
                return {
                    code: data.code,
                    display: data.display,
                    diagnosisId: data?.property?.[0]?.valueInteger || null
                }
            }
            else if(this.reqType == "symptoms"){
                let section = data?.extension?.find(d => d.url == "https://www.lattice.in/fhir/StructureDefinition/symptom-section");
                let gender = data?.extension?.find(d => d.url == "https://www.lattice.in/fhir/StructureDefinition/gender");
                return {
                    code: data.code,
                    display: data.display,
                    type: section ? section?.valueString?.trim() : null,
                    gender: gender ? gender?.valueCode?.trim() : null 
                }
            }
        });
    }
     getFHIRToJSONOutput() {
        this.getCode();     
        return this.valueset_obj;
    }

}


module.exports = ValueSet;