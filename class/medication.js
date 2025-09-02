let { checkEmptyData } = require("../services/CheckEmpty");


class Medication {
    medicineObj;
    fhirResource;
    reqType;
    constructor(medicineObj, fhir_resource) {
        this.medicineObj = medicineObj;
        this.fhirResource = fhir_resource;
        this.fhirResource.resourceType = "Medication"
    }

    getCode() {
        
        this.medicineObj.medFhirId = this.fhirResource.id
        if (!checkEmptyData(this.fhirResource.code) && this.fhirResource.code.coding) {
            this.medicineObj.code = this.fhirResource.code.coding[0].code;
            this.medicineObj.name = this.fhirResource.code.coding[0].display;
        }
        
    }

    setCode() {
        this.fhirResource.status = "active"
        this.fhirResource.code = [
            {
                coding: [
                    {
                        system: "http://heartcare.org",
                        code:   this.medicineObj.code,
                        display:  `${this.medicineObj.name} ${this.medicineObj.dosage} mg tablet`
                      }
                ]
            }
        ]
    }

    getIsOTC() {
        this.medicineObj.isOTC = this.fhirResource.extension && this.fhirResource.extension[0].valueBoolean == true ? true : false
    }

    setIsOtc() {
        this.fhirResource.extension = [
            {
                "url": "http://heartcare.org",
                valueBoolean: false
            }
        ]
    }
    getStatus() {
        this.medicineObj.status = this.fhirResource?.status || "active"
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

    setDoseForm() {
        this.fhirResource.form = [
            {
                "coding": [
                        {
                            "system": "http://snomed.info/sct",
                            "code": "421026006",
                            "display": "Tablet"
                        }
                    ],
                    "text": "Tablet"
            }
        ]
         
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
                // this.medicineObj.strength = this.fhirResource.ingredient.map(e => {
                //    const medName = e.itemCodeableConcept.coding[0].display;
                //    const unitMeasureValue = e.strength.numerator.value;
                //    const medMeasureCode = e.strength.numerator.code;
                //    return {medName, unitMeasureValue, medMeasureCode}
                // })
            }
        }
    }

    setIngredientData() {
        this.fhirResource.ingredient = [
            {
                "itemCodeableConcept": {
                    "coding": [
                        {
                            "system": "http://heartcare.org",
                            "code": this.medicineObj.code,
                            "display": `${this.medicineObj.name} ${this.medicineObj.dosage} mg`
                        }
                    ]
                },
                "strength": {
                    "numerator": {
                        "value": this.medicineObj.dosage,
                        "system": "http://unitsofmeasure.org",
                        "code": "mg"
                    },
                    "denominator": {
                        "value": 1,
                        "system": "http://unitsofmeasure.org",
                        "code": "mg"
                    }
                }
            }
        ]
    }

    patchStatus() {
        if (!checkEmptyData(this.medicineObj.status))
            this.fhirResource.push({ "op": "replace", "path": "/status", "value": this.medicineObj.status })
    }

    getJsonToFhirTranslator() {
        this.setCode();
        this.setIsOtc();
        this.setDoseForm();
        this.setIngredientData();
    }
    getFHIRToTransformedResult() {
        this.getCode();
        this.getIsOTC();
        this.getDoseForm(); 
        this.getStatus();  
        this.getIngredientData();   
    }

    setPatchData() {
        this.patchStatus();
    }

    getFHIRResource() {
        return this.fhirResource
    }

    getSimplifiedOutput() {
        return this.medicineObj;
    }

}


module.exports = Medication;