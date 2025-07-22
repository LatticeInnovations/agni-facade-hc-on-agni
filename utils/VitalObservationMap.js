const vitalCVDMethodConfig = {
    height: {
        code: 'setHeightCode',
        component: 'setHeightComponent',
        dataMethod: 'getHeightData',
        patchMethod: 'patchUserInputToFhirHeight'
    },
    weight: {
        code: 'setWeightCode',
        component: 'setWeightComponent',
        dataMethod: 'getWeightData',
        patchMethod: 'patchUserInputToFhirWeight'
    },
    heartRate: {
        code: 'setHeartRateCode',
        component: 'setHeartRateComponent',
        dataMethod: 'getHeartRate',
        patchMethod: 'patchUserInputToFhirHeartRate'
    },
    respRate: {
        code: 'setRespRateCode',
        component: 'setRespRateComponent',
        dataMethod: 'getRespRate',
        patchMethod: 'patchUserInputToFhirRespRate'
    },
    spo2: {
        code: 'setSpo2Code',
        component: 'setSpo2Component',
        dataMethod: 'getSpo2',
        patchMethod: 'patchUserInputToFhirSpo2'
    },
    temperature: {
        code: 'setTempCode',
        component: 'setTempComponent',
        dataMethod: 'getTemperature',
        patchMethod: 'patchUserInputToFhirTemp'
    },
    bp: {
        code: 'setBPCode',
        component: 'setBPComponent',
        dataMethod: 'getBloodPressure',
        patchMethod: 'patchUserInputToFhirBloodPressure'
    },
    bloodGlucose: {
        code: 'setBloodGlucoseCode',
        component: 'setBloodGlucoseComponent',
        dataMethod: 'getBloodGlucose',
        patchMethod: 'patchUserInputToFhirBloodGlucose'
    },
    eyeTest: {
        code: 'setEyeTestCode',
        component: 'setEyeTestComponent',
        dataMethod: 'getEyeTest',
        patchMethod: 'patchUserInputToFhirEyeTest'
    },
    cholesterol: {
        code: 'setCholesterolCode',
        component: 'setCholesterolComponent',
        dataMethod: 'getCholesterolData',
        patchMethod: 'patchUserInputToFhirDiabetic'
    },
    bmi: {
        code: 'setBMICode',
        component: 'setBMIComponent',
        dataMethod: 'getBMIData',
        patchMethod: 'patchUserInputToFhirSmoker'
    },
    diabetic: {
        code: 'setDiabeticCode',
        component: 'setDiabeticComponent',
        dataMethod: 'getDiabeticData',
        patchMethod: 'patchUserInputToFhirCholesterol'
    },
    smoker: {
        code: 'setSmokerCode',
        component: 'setSmokerComponent',
        dataMethod: 'getSmokerData',
        patchMethod: 'patchUserInputToFhirBMI'
    },
    risk: {
        code: 'setRiskCode',
        component: 'setRiskComponent',
        dataMethod: 'getRiskData',
        patchMethod: 'patchUserInputToFhirRisk'
    },
    heartAttackHistory: {
        code: 'setHeartAttackHistoryCode',
        component: 'setHeartAttackHistoryComponent',
        dataMethod: 'getHeartAttackHistoryData',
        patchMethod: 'patchUserInputToFhirHeartAttackHistory'
    }
};

const fhirTextToVitalType = {
    "Height": "height",
    "Weight": "weight",
    "Heart Rate": "heartRate",
    "Respiratory rate": "respRate",
    "spO2": "spo2",
    "Body temperature": "temperature",
    "Blood Pressure": "bp",
    "Blood Glucose": "bloodGlucose",
    "Eye Test": "eyeTest"
  };

  const fhirTextToCVDType = {
    "Height": "height",
    "Weight": "weight",
    "Blood Pressure": "bp",
    "Diabetic status": "diabetic",
    "Smoking Status": "smoker",
    "Cholesterol": "cholesterol",
    "BMI": "bmi",
    // "CVD Risk Percentage": "risk"
    "Previous heart attack or stroke": "heartAttackHistory"
  };


  


module.exports = {vitalCVDMethodConfig, fhirTextToVitalType, fhirTextToCVDType};