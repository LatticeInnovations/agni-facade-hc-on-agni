const BaseObservation = require("./BaseObservation");
const {vitalCVDMethodConfig, fhirTextToVitalType, fhirTextToCVDType} = require("../utils/VitalObservationMap");

class CVDObservation extends BaseObservation {
    static requiresVitalType = true;
  constructor(observationObj, fhirResource, vitalType) {
    super(observationObj, fhirResource);
    this.vitalType = vitalType;
  }

  setEncounterReference() {
    if(this.observationObj?.encounterId) {
        this.fhirResource.encounter.reference = this.observationObj?.fhirId? "Encounter/" + this.observationObj?.encounterId: 'urn:uuid:' + this.observationObj?.encounterId;
    }
   
}


getBloodPressure() {
    let bpDiastolic = this.fhirResource?.component?.find((element) => {
        return element.code.text === "Diastolic blood pressure"
    });

    let bpSystolic = this.fhirResource?.component?.find((element) => {
        return element.code.text === "Systolic blood pressure"
    });
    this.observationObj.bpDiastolic = bpDiastolic ? bpDiastolic.valueQuantity.value : null;
    this.observationObj.bpSystolic = bpSystolic ? bpSystolic.valueQuantity.value : null;
}

getTemperature() {
    let temp = this.fhirResource?.component?.find((element) => {
        return element.code.text === "Body temperature"
    });
    this.observationObj.temp = temp ? temp.valueQuantity.value : null; 
    this.observationObj.tempUnit = temp ? temp.valueQuantity.unit : null;
}

getSpo2() {
    let spo2 = this.fhirResource?.component?.find((element) => {
        return element.code.text === "spO2"
    });
    this.observationObj.spo2 = spo2 ? spo2.valueQuantity.value : null; 
}

getRespRate() {
    let respRate = this.fhirResource?.component?.find((element) => {
        return element.code.text === "Respiratory rate"
    });
    this.observationObj.respRate = respRate ? respRate.valueQuantity.value : null;
}

getHeartRate() {
    let heartRate = this.fhirResource?.component?.find((element) => {
        return element.code.text === "Heart Rate"
    });
    this.observationObj.heartRate = heartRate ? heartRate.valueQuantity.value : null;
}

getWeightData() {
    let weight = this.fhirResource?.component?.find((element) => {
        return element.code.text === "Weight"
    });
    this.observationObj.weight = weight ? weight.valueQuantity.value : null;
    this.observationObj.weightUnit = weight ? weight.valueQuantity?.unit : null;

}

getHeightData() {
    let feet =  this.fhirResource?.component?.find((element) => {
        return element.code.text === "Height in feet"
    });
    this.observationObj.heightFt = feet ? feet.valueQuantity.value : null;
    let inch = this.fhirResource?.component?.find((element) => {
        return element.code.text === "Height in inches"
    });
    this.observationObj.heightInch = inch ? inch.valueQuantity.value : null;
    let cm = this.fhirResource?.component?.find((element) => {
        return element.code.text === "Height in centimeter"
    });
    this.observationObj.heightCm = cm ? cm.valueQuantity.value : null;
}

getDiabeticData() {
    let diabetic = this.fhirResource?.component?.find((element) => {
        return element.code.text === "Diabetic status"
    });
    this.observationObj.diabetic = diabetic ? diabetic.valueQuantity.value : 0;
}

getSmokerData() {
    let smoker = this.fhirResource?.component?.find((element) => {
        return element.code.text === "Smoking Status"
    });
    this.observationObj.smoker = smoker ? smoker.valueQuantity.value : 0;
}

getHeartAttackHistoryData() {
    let heartAttackHistory = this.fhirResource?.component?.find((element) => {
        return element.code.text === "heartAttackHistory"
    });
    this.observationObj.heartAttackHistory = heartAttackHistory ? heartAttackHistory.valueQuantity.value : 0;
}

getCholesterolData() {
    let cholesterol = this.fhirResource?.component?.find((element) => {
        return element.code.text === "Cholesterol"
    });
    this.observationObj.cholesterol = cholesterol ? cholesterol.valueQuantity?.value : null;
    this.observationObj.cholesterolUnit = cholesterol ? cholesterol.valueQuantity?.unit : null;
}

getBMIData() {
    let bmi = this.fhirResource?.component?.find((element) => {
        return element.code.text === "BMI"
    });
    this.observationObj.bmi = bmi ? bmi.valueQuantity?.value : null;
}

getRiskData() {
    console.log("check if risk is here:")
    let risk = this.fhirResource?.component?.find((element) => {
        return element.code.text === "CVD Risk Percentage"
    });
    this.observationObj.risk = risk ? risk.valueQuantity?.value : null;
}



setBPComponent() {
    if(this.observationObj?.bpDiastolic){
        this.fhirResource.component.push({
            "code": {
            "coding": [
                {
                "system": "https://loinc.org",
                "code": "8462-4",
                "display": "Diastolic blood pressure"
                }
            ],
            "text": "Diastolic blood pressure"
            },
            "valueQuantity": {
            "value": this.observationObj?.bpDiastolic,
            "unit": "mmHg",
            "system": "https://unitsofmeasure.org",
            "code": "mm[Hg]"
            }
        });
    }

    if(this.observationObj?.bpSystolic){
        this.fhirResource.component.push({
            "code": {
            "coding": [
                {
                "system": "https://loinc.org",
                "code": "8480-6",
                "display": "Systolic blood pressure"
                }
            ],
            "text": "Systolic blood pressure"
            },
            "valueQuantity": {
            "value": this.observationObj?.bpSystolic,
            "unit": "mmHg",
            "system": "https://unitsofmeasure.org",
            "code": "mm[Hg]"
            }
        });
    }
}

setBPCode() {
    this.fhirResource.code = {
        "coding": [
        {
            "system": "https://loinc.org",
            "code": "35094-2",
            "display": "Blood Pressure"
        }
        ],
        "text": "Blood Pressure"
    }
}



setWeightComponent() {
    if(this.observationObj?.weight) {
        this.fhirResource.component.push({
            "code": {
            "coding": [
                {
                "system": "https://loinc.org",
                "code": "29463-7",
                "display": "weight"
                }
            ],
            "text": "Weight"
            },
            "valueQuantity": {
            "value": this.observationObj?.weight,
            "unit": this.observationObj?.weightUnit || null,
            "system": "https://unitsofmeasure.org",
            "code": this.observationObj?.weightUnit || null
            }
        });
    }
}

setWeightCode() {
    this.fhirResource.code = {
        "coding": [
        {
            "system": "https://loinc.org",
            "code": "29463-7",
            "display": "weight"
        }
        ],
        "text": "Weight"
    }
}

setHeartRateComponent() {
    if(this.observationObj?.heartRate){
        this.fhirResource.component.push({
            "code": {
                "coding": [
                    {
                        "system": "https://loinc.org",
                        "code": "8867-4",
                        "display": "Heart rate"
                    }
                ],
                "text": "Heart Rate"
            },
            "valueQuantity": {
                "value": this.observationObj?.heartRate,
                "unit": "beats/minute",
                "system": "https://unitsofmeasure.org",
                "code": "/min"
            }
        });
    }
}

setHeartRateCode() {
    this.fhirResource.code = {
        "coding": [
        {
            "system": "https://loinc.org",
            "code": "8867-4",
            "display": "Heart Rate"
        }
        ],
        "text": "Heart Rate"
    }
}


setHeightComponent() {
    if(this.observationObj?.heightFt){
        this.fhirResource.component.push({
            "code": {
            "coding": [
                {
                "system": "https://loinc.org",
                "code": "8302-2",
                "display": "height"
                }
            ],
            "text": "Height in feet"
            },
            "valueQuantity": {
            "value": this.observationObj?.heightFt,
            "unit": "ft",
            "system": "https://unitsofmeasure.org",
            "code": "[ft_i]"
            }
        });
    }

    if(this.observationObj?.heightInch){
        this.fhirResource.component.push({
            "code": {
            "coding": [
                {
                "system": "https://loinc.org",
                "code": "8302-2",
                "display": "height"
                }
            ],
            "text": "Height in inches"
            },
            "valueQuantity": {
            "value": this.observationObj?.heightInch,
            "unit": "in",
            "system": "https://unitsofmeasure.org",
            "code": "[in_i]"
            }
        });
    }

    if(this.observationObj?.heightCm){
        this.fhirResource.component.push({
            "code": {
            "coding": [
                {
                "system": "https://loinc.org",
                "code": "8302-2",
                "display": "height"
                }
            ],
            "text": "Height in centimeter"
            },
            "valueQuantity": {
            "value": this.observationObj?.heightCm,
            "unit": "cm",
            "system": "https://unitsofmeasure.org",
            "code": "[cm_i]"
            }
        });
    }
}

setHeightCode() {
    this.fhirResource.code = {
        "coding": [
        {
            "system": "https://loinc.org",
            "code": "8302-2",
            "display": "height"
        }
        ],
        "text": "Height"
    }
}

setDiabeticCode() {
    this.fhirResource.code = {
        "coding": [
        {
            "system": "https://loinc.org",
            "code": "33248-6",
            "display": "Diabetic status"
        }
        ],
        "text": "Diabetic status"
    }
}

setDiabeticComponent() {
    if(this.observationObj?.diabetic){
        this.fhirResource.component.push({
            "code": {
            "coding": [
                {
                "system": "https://loinc.org",
                "code": "33248-6",
                "display": "Diabetic status"
                }
            ],
            "text": "Diabetic status"
            },
            "valueQuantity": {
            "value": this.observationObj?.diabetic,
            "system": "https://unitsofmeasure.org",
            }
        });
    }
}

setSmokerCode() {
    this.fhirResource.code = {
        "coding": [
        {
            "system": "https://loinc.org",
            "code": "72166-2",
            "display": "smoking status"
        }
        ],
        "text": "Smoking Status"
    }
}

setSmokerComponent() {
    if(this.observationObj?.smoker){
        this.fhirResource.component.push({
            "code": {
            "coding": [
                {
                "system": "https://loinc.org",
                "code": "72166-2",
                "display": "smoking status"
                }
            ],
            "text": "Smoking Status"
            },
            "valueQuantity": {
            "value": this.observationObj?.smoker,
            "system": "https://unitsofmeasure.org",
            }
        });
    }
}

setCholesterolCode() {
    this.fhirResource.code = {
        "coding": [
        {
            "system": "https://loinc.org",
            "code": "2093-3",
            "display": "Cholesterol [Mass/volume] in Serum or Plasma"
        }
        ],
        "text": "Cholesterol"
    }
}

setCholesterolComponent() {
    if(this.observationObj?.cholesterol){
        this.fhirResource.component.push({
            "code": {
            "coding": [
                {
                "system": "https://loinc.org",
                "code": "2093-3",
                "display": "Cholesterol [Mass/volume] in Serum or Plasma"
                }
            ],
            "text": "Cholesterol"
            },
            "valueQuantity": {
            "value": this.observationObj?.cholesterol,
            "unit": this.observationObj?.cholesterolUnit,
            "system": "https://unitsofmeasure.org",
            "code": this.observationObj?.cholesterolUnit
            }
        });
    }
}

setBMICode() {
    this.fhirResource.code = {
        "coding": [
        {
            "system": "https://loinc.org",
            "code": "9156-5",
            "display": "Body mass index (BMI) [Ratio]"
        }
        ],
        "text": "BMI"
    }
}

setBMIComponent() {
    if(this.observationObj?.bmi){
        this.fhirResource.component.push({
            "code": {
            "coding": [
                {
                "system": "https://loinc.org",
                "code": "9156-5",
                "display": "Body mass index (BMI) [Ratio]"
                }
            ],
            "text": "BMI"
            },
            "valueQuantity": {
            "value": this.observationObj?.bmi,
            "unit": "kg/m2",
            "system": "https://unitsofmeasure.org",
            "code": "kg/m2"
            }
        });
    }
}

setHeartAttackHistoryCode() {
    this.fhirResource.code = {
        "coding": [
        {
            "system": "https://loinc.org",
            "code": "78941-2",
            "display": "Previous heart attack or stroke"
        }
        ],
        "text": "Previous heart attack or stroke"
    }
}

setHeartAttackHistoryComponent() {
    if(this.observationObj?.heartAttackHistory){
        this.fhirResource.component.push({
            "code": {
            "coding": [
                {
                "system": "https://loinc.org",
                "code": "72166-2",
                "display": "Previous heart attack or stroke"
                }
            ],
            "text": "heartAttackHistory"
            },
            "valueQuantity": {
            "value": this.observationObj?.heartAttackHistory,
            "system": "https://unitsofmeasure.org",
            }
        });
    }
}

setRiskCode() {
    this.fhirResource.code = {
        "coding": [
        {
            "system": "https://loinc.org",
            "code": "72333-9",
            "display": "Cardiovascular disease risk score"
        }
        ],
        "text": "CVD Risk Percentage"
    }
}

setRiskComponent() {
    console.log("check if risk is there: =================>",this.observationObj )
    if(this.observationObj?.risk){
        this.fhirResource.component.push({
            "code": {
            "coding": [
                {
                "system": "https://loinc.org",
                "code": "72333-9",
                "display": "Cardiovascular disease risk score"
                }
            ],
            "text": "CVD Risk Percentage"
            },
            "valueQuantity": {
            "value": this.observationObj?.risk,
            "unit": "%",
            "system": "https://unitsofmeasure.org",
            "code": "%"
            }
        });
    }
}

getJsonToFhirTranslator() {
    const config = vitalCVDMethodConfig[this.vitalType]
    console.log("check config: ", config, this.vitalType)
    if(!config)
        console.warn(`Unsupported vitalType: ${this.vitalType}`);
    else {
        this.setCommonCVDStructure();
        this.setEncounterReference();
        this.setPatientReference();
        this.setPractitionerReference();
        this[config.code]();
        this[config.component]();
    }
}

setCommonCVDStructure() {
    this.fhirResource.resourceType = "Observation";
    this.fhirResource.status = "final";
    this.setBasicStructure();
    if (this.observationObj.appUpdatedDate) {
      this.fhirResource.effectiveDateTime = this.observationObj.appUpdatedDate;
    }
  }

getFHIRToTransformedResult() {
    this.getFhirId();
    const module_type = this.fhirResource.module_type == "vital"? fhirTextToVitalType : fhirTextToCVDType
    console.log("module_type: ", module_type)
    const codeText = this.fhirResource?.code?.text;
    const derivedVitalType = module_type[codeText];
    const config = vitalCVDMethodConfig[derivedVitalType];
    this.vitalType = derivedVitalType;
    console.log("check vital type: ", config.dataMethod, this.vitalType)
    if(!config || !config.dataMethod){
        console.warn(`Unsupported vital type: ${derivedVitalType}`)
    }
    else {        
        this[config.dataMethod]();
    }

}

setPatchData() {
    this.fhirResource.component = []
    const config = vitalCVDMethodConfig[this.vitalType];
    if (!config) {
        console.warn(`Unsupported vital type: ${this.vitalType}`);
    }
    else {
       this[config.component]();
    }

}

}


module.exports = CVDObservation;