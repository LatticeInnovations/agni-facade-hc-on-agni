const vitalMethodConfig = {
    height: {
        code: 'setHeightCode',
        component: 'setHeightComponent',
        dataMethod: 'getHeightData'
    },
    weight: {
        code: 'setWeightCode',
        component: 'setWeightComponent',
        dataMethod: 'getWeightData'
    },
    heartRate: {
        code: 'setHeartRateCode',
        component: 'setHeartRateComponent',
        dataMethod: 'getHeartRate'
    },
    respRate: {
        code: 'setRespRateCode',
        component: 'setRespRateComponent',
        dataMethod: 'getRespRate'
    },
    spo2: {
        code: 'setSpo2Code',
        component: 'setSpo2Component',
        dataMethod: 'getSpo2'
    },
    temperature: {
        code: 'setTempCode',
        component: 'setTempComponent',
        dataMethod: 'getTemperature'
    },
    bp: {
        code: 'setBPCode',
        component: 'setBPComponent',
        dataMethod: 'getBloodPressure'
    },
    bloodGlucose: {
        code: 'setBloodGlucoseCode',
        component: 'setBloodGlucoseComponent',
        dataMethod: 'getBloodGlucose'
    },
    eyeTest: {
        code: 'setEyeTestCode',
        component: 'setEyeTestComponent',
        dataMethod: 'getEyeTest'
    },
    cholesterol: {
        code: 'setCholesterolCode',
        component: 'setCholesterolComponent',
        dataMethod: 'getCholesterolData'
    },
    bmi: {
        code: 'setBMICode',
        component: 'setBMIComponent',
        dataMethod: 'getBMIData'
    },
    diabetic: {
        code: 'setDiabeticCode',
        component: 'setDiabeticComponent',
        dataMethod: 'getDiabeticData'
    },
    smoker: {
        code: 'setSmokerCode',
        component: 'setSmokerComponent',
        dataMethod: 'getSmokerData'
    },
    risk: {
        code: 'setRiskCode',
        component: 'setRiskComponent',
        dataMethod: 'getRiskData'
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
    "Eye Test": "eyeTest",
    "Cholesterol": "cholesterol"
  };

module.exports = {vitalMethodConfig, fhirTextToVitalType};