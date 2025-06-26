let { checkEmptyData } = require("../services/CheckEmpty");


class Medication {
    medicine_obj;
    fhirResource;
    reqType;
    constructor(medicine_obj, fhir_resource) {
        this.medicine_obj = medicine_obj;
        this.fhirResource = fhir_resource;
    }

    getCode() {
        this.medicine_obj.medFhirId = this.fhirResource.id
        if (!checkEmptyData(this.fhirResource.code) && this.fhirResource.code.coding) {
            this.medicine_obj.medCode = this.fhirResource.code.coding[0].code;
            this.medicine_obj.medName = this.fhirResource.code.coding[0].display;
        }
    }

    getIsOTC() {
        this.medicine_obj.isOTC = this.fhirResource.extension && this.fhirResource.extension[0].valueBoolean == true ? true : false
    }
    getDoseForm() {
        if (!checkEmptyData(this.fhirResource.form) && this.fhirResource.form.coding) {
            if(!this.fhirResource.form.coding[0].code || !this.fhirResource.form.coding[0].display) {
                this.medicine_obj.doseForm = null;
                this.medicine_obj.doseFormCode = null;
            }
            else {
                this.medicine_obj.doseForm = this.fhirResource.form.coding[0].display;
                this.medicine_obj.doseFormCode = this.fhirResource.form.coding[0].code;

            }
        }
        else {
            this.medicine_obj.doseForm = null;
            this.medicine_obj.doseFormCode = null;
        }
    }

    getIngredientData() {
        if (this.fhirResource.ingredient) {
            this.medicine_obj.activeIngredient = this.fhirResource.ingredient.map(e => {
                if( e.itemCodeableConcept)
                    return e.itemCodeableConcept.coding[0].display})
                .join("+");
            this.medicine_obj.activeIngredientCode = this.fhirResource.ingredient.map(e => {
                if( e.itemCodeableConcept)
                    return e.itemCodeableConcept.coding[0].code})
                .join("+");
            if(this.fhirResource.ingredient[0].strength) {
                this.medicine_obj.medUnit = this.fhirResource.ingredient[0].strength.numerator.code;
                this.medicine_obj.medNumeratorVal = this.fhirResource.ingredient[0].strength.numerator.value;
                this.medicine_obj.strength = this.fhirResource.ingredient.map(e => {
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

    getMedicationResource() {
        return this.medicine_obj;
    }

}


module.exports = Medication;