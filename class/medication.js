let { checkEmptyData } = require("../services/CheckEmpty");


class Medication {
    medicineObj;
    fhirResource;
    reqType;
    constructor(medicineObj, fhir_resource) {
        this.medicineObj = medicineObj;
        this.fhirResource = fhir_resource;
    }

    getCode() {
        
        this.medicineObj.medFhirId = this.fhirResource.id
        if (!checkEmptyData(this.fhirResource.code) && this.fhirResource.code.coding) {
            this.medicineObj.medCode = this.fhirResource.code.coding[0].code;
            this.medicineObj.medName = this.fhirResource.code.coding[0].display;
        }
        
    }

    getIsOTC() {
        this.medicineObj.isOTC = this.fhirResource.extension && this.fhirResource.extension[0].valueBoolean == true ? true : false
    }
    getDoseForm() {
        if (!checkEmptyData(this.fhirResource.form) && this.fhirResource.form.coding) {
            if(!this.fhirResource.form.coding[0].code || !this.fhirResource.form.coding[0].display) {
                this.medicineObj.doseForm = null;
                this.medicineObj.doseFormCode = null;
            }
            else {
                this.medicineObj.doseForm = this.fhirResource.form.coding[0].display;
                this.medicineObj.doseFormCode = this.fhirResource.form.coding[0].code;

            }
        }
        else {
            this.medicineObj.doseForm = null;
            this.medicineObj.doseFormCode = null;
        }
    }

    getIngredientData() {
        if (this.fhirResource.ingredient) {
            this.medicineObj.activeIngredient = this.fhirResource.ingredient.map(e => {
                if( e.itemCodeableConcept)
                    return e.itemCodeableConcept.coding[0].display})
                .join("+");
            this.medicineObj.activeIngredientCode = this.fhirResource.ingredient.map(e => {
                if( e.itemCodeableConcept)
                    return e.itemCodeableConcept.coding[0].code})
                .join("+");
            if(this.fhirResource.ingredient[0].strength) {
                this.medicineObj.medUnit = this.fhirResource.ingredient[0].strength.numerator.code;
                this.medicineObj.medNumeratorVal = this.fhirResource.ingredient[0].strength.numerator.value;
                this.medicineObj.strength = this.fhirResource.ingredient.map(e => {
                   const medName = e.itemCodeableConcept.coding[0].display;
                   const unitMeasureValue = e.strength.numerator.value;
                   const medMeasureCode = e.strength.numerator.code;
                   return {medName, unitMeasureValue, medMeasureCode}
                })
            }
        }
    }

    getFHIRToTransformedResult() {
        this.getCode();
        this.getIsOTC();
        this.getDoseForm();
        this.getIngredientData();       
    }

    getSimplifiedOutput() {
        return this.medicineObj;
    }

}


module.exports = Medication;