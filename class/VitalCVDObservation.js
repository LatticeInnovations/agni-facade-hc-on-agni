const BaseObservation = require("./BaseObservation");
const {vitalCVDMethodConfig, fhirTextToVitalType, fhirTextToCVDType} = require("../utils/VitalObservationMap");

class VitalObservation extends BaseObservation {
    static requiresVitalType = true;
  constructor(observationObj, fhirResource, vitalType) {
    super(observationObj, fhirResource);
    this.vitalType = vitalType;
  }

 
getEyeTest() {
    let eyeTestTypeWithoutGlass = this.fhirResource?.component?.find((element) => {
        return element.code.text === "Without glasses"
    });
    let eyeTestTypeWithGlass = this.fhirResource?.component?.find((element) => {
        return element.code.text === "With glasses"
    });
    this.observationObj.eyeTestType = eyeTestTypeWithoutGlass ? "1" : null;
    this.observationObj.eyeTestType = eyeTestTypeWithGlass ? "2" : this.observationObj.eyeTestType;
    this.observationObj.leftEye = this.fhirResource?.component?.[0]?.valueQuantity?.value || null;
    this.observationObj.rightEye = this.fhirResource?.component?.[1]?.valueQuantity?.value || null;
}

getBloodGlucose() {
    this.observationObj.bloodGlucoseType = this.fhirResource?.component?.[0]?.code?.text === "Fasting Blood Glucose" ? "fasting" : null;
    this.observationObj.bloodGlucoseType = this.fhirResource?.component?.[0]?.code?.text === "Random Blood Glucose" ? "random" : this.observationObj.bloodGlucoseType;
    this.observationObj.bloodGlucose = this.fhirResource?.component?.[0]?.valueQuantity?.value || null;
    this.observationObj.bloodGlucoseUnit = this.fhirResource?.component?.[0]?.valueQuantity?.unit || null;
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
    let risk = this.fhirResource?.component?.find((element) => {
        return element.code.text === "CVD Risk Percentage"
    });
    this.observationObj.risk = risk ? risk.valueQuantity?.value : null;
}



setEyeTestComponent() {
    if(this.observationObj?.leftEye){
        this.fhirResource.component.push({
            "code": {
                "coding": [
                    {
                        "system": "https://loinc.org",
                        "code": "98498-9",
                        "display": "Visual acuity left eye"
                    }
                ],
                text: this.observationObj?.eyeTestType == "1" ? "Without glasses" : "With glasses"
            },
            "valueQuantity": {
                "value": this.observationObj?.leftEye,
                "unit": "feet",
                "system": "https://unitsofmeasure.org",
                "code": "[ft_i]"
            }
        });
    }

    if(this.observationObj?.rightEye){
        this.fhirResource.component.push({
            "code": {
                "coding": [
                    {
                    "system": "https://loinc.org",
                    "code": "98499-7",
                    "display": "Visual acuity right eye"
                }
                ],
                text: this.observationObj?.eyeTestType == "1" ? "Without glasses" : "With glasses"
            },
            "valueQuantity": {
                "value": this.observationObj?.rightEye,
                "unit": "feet",
                "system": "https://unitsofmeasure.org",
                "code": "[ft_i]"
            }
        });
    }
}

setEyeTestCode() {
    this.fhirResource.code = {
        "coding": [
            {
                "system": "https://loinc.org",
                "code": "70937-8",
                "display": "Visual Acuity"
            }
        ],
        text: "Eye Test"
    }
}

setBloodGlucoseComponent() {
    if(this.observationObj?.bloodGlucose){
        this.fhirResource.component.push({
            "code": {
            "coding": [
                {
                "system": "https://loinc.org",
                "code": "1558-6",
                "display": this.observationObj?.bloodGlucoseType === "fasting" ? "fasting" : "random"
                }
            ],
            "text": this.observationObj?.bloodGlucoseType === "fasting" ? "Fasting Blood Glucose" : "Random Blood Glucose"
            },
            "valueQuantity": {
            "value": this.observationObj?.bloodGlucose,
            "unit": this.observationObj?.bloodGlucoseUnit === "mg/dl" ? "mg/dl" : "mmol/L",
            "system": "https://unitsofmeasure.org",
            "code": this.observationObj?.bloodGlucoseUnit === "mg/dl" ? "mg/dl" : "mmol/L"
            }
        });
    }
}

setBloodGlucoseCode() {
    this.fhirResource.code = {
        "coding": [
        {
            "system": "https://loinc.org",
            "code": "74774-1",
            "display": "glucose"
        }
        ],
        "text": "Blood Glucose"
    }
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

setTempComponent() {
    if(this.observationObj?.temp){
        this.fhirResource.component.push({
            "code": {
                "coding": [
                    {
                        "system": "https://loinc.org",
                        "code": "8310-5",
                        "display": "Body temperature"
                    }
                ],
                "text": "Body temperature"
            },
            "valueQuantity": {
                "value": this.observationObj?.temp,
                "unit": this.observationObj?.tempUnit === "F" ? "F" : "C",
                "system": "https://unitsofmeasure.org",
                "code": this.observationObj?.tempUnit === "F" ? "Fahrenheit" : "Celsius"
            }
        });
    }
}

setTempCode() {
    this.fhirResource.code = {
        "coding": [
        {
            "system": "https://loinc.org",
            "code": "8310-5",
            "display": "Body temperature"
        }
        ],
        "text": "Body temperature"
    }
}

setSpo2Component() {
    if(this.observationObj?.spo2){
        this.fhirResource.component.push({
            "code": {
                "coding": [
                    {
                        "system": "https://loinc.org",
                        "code": "2708-6",
                        "display": "Oxygen saturation in Arterial blood"
                    },
                    {
                        "system": "https://loinc.org",
                        "code": "59408-5",
                        "display": "Oxygen saturation in Arterial blood by Pulse oximetry"
                    },
                    {
                        "system": "urn:iso:std:iso:11073:10101",
                        "code": "150456",
                        "display": "MDC_PULS_OXIM_SAT_O2"
                    }
                ],
                "text": "spO2"
            },
            "valueQuantity": {
                "value": this.observationObj?.spo2,
                "unit": "%",
                "system": "https://unitsofmeasure.org",
                "code": "%"
            }
        });
    }
}

setSpo2Code() {
    this.fhirResource.code = {
        "coding": [
        {
            "system": "https://loinc.org",
            "code": "2708-6",
            "display": "Oxygen saturation in Arterial blood"
        },
        {
            "system": "https://loinc.org",
            "code": "59408-5",
            "display": "Oxygen saturation in Arterial blood by Pulse oximetry"
        },
        {
            "system": "urn:iso:std:iso:11073:10101",
            "code": "150456",
            "display": "MDC_PULS_OXIM_SAT_O2"
        }
        ],
        "text": "spO2"
    }
}

setRespRateComponent() {
    if(this.observationObj?.respRate){
        this.fhirResource.component.push({
        "code": {
            "coding": [
                {
                "system": "https://loinc.org",
                "code": "9279-1",
                "display": "Respiratory rate"
                }
            ],
            "text": "Respiratory rate"
            },
            "valueQuantity": {
                "value": this.observationObj?.respRate,
                "unit": "breaths/minute",
                "system": "https://unitsofmeasure.org",
                "code": "/min"
            }
        });
    }
}

setRespRateCode() {
    this.fhirResource.code = {
        "coding": [
        {
            "system": "https://loinc.org",
            "code": "9279-1",
            "display": "Respiratory rate"
        }
        ],
        "text": "Respiratory rate"
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
            "unit": "kg",
            "system": "https://unitsofmeasure.org",
            "code": "kg"
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
    console.log("check if it reaches risk: ", this.observationObj)
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
    // console.log("config is: ", config, vitalMethodConfig)
    if(!config)
        console.warn(`Unsupported vitalType: ${this.vitalType}`);
    else {
        this.setCommonVitalsStructure();
        this[config.code]();
        this[config.component]();
    }
}

getFHIRToTransformedResult() {
    const module_type = this.fhirResource.module_type == "vital"? fhirTextToVitalType : fhirTextToCVDType
    const codeText = this.fhirResource?.code?.text;
    const derivedVitalType = module_type[codeText];
    const config = vitalCVDMethodConfig[derivedVitalType];
    this.vitalType = derivedVitalType;
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


module.exports = VitalObservation;