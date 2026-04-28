function getBmiClass(bmi) {
    if (bmi == null) return null;
    if (bmi < 18.5) return "underweight";
    if (bmi < 25) return "normal";
    if (bmi < 30) return "overweight";
    return "obese";
}

function getBpClass(sysBP, diaBP) {
    if (sysBP == null || diaBP == null) return null;
    if (sysBP >= 180 || diaBP >= 120) return "veryHigh";
    if (sysBP >= 160 || diaBP >= 100) return "high";
    if (sysBP >= 140 || diaBP >= 90) return "moderate";
    if (sysBP >= 120 || diaBP >= 80) return "normal";
    return "optimal";
}

function getGlucoseClass(glucose) {
    if (glucose == null) return null;
    return glucose <= 5.5 ? "normal" : "aboveNormal";
}

function getCholesterolClass(cholesterol) {
    if (cholesterol == null) return null;
    return cholesterol <= 5.2 ? "normal" : "high";
}

function getCvdRiskClass(cvdRisk) {
    if (cvdRisk == null) return null;
    if (cvdRisk < 10) return "low";
    if (cvdRisk < 20) return "moderate";
    if (cvdRisk < 30) return "high";
    return "veryHigh";
}

function calculateClassifications(data) {
    return {
        bmiClass: getBmiClass(data.bmi),
        bpClass: getBpClass(data.sysBP, data.diaBP),
        glucoseClass: getGlucoseClass(data.glucose),
        cholesterolClass: getCholesterolClass(data.cholesterol),
        cvdRiskClass: getCvdRiskClass(data.cvdRisk)
    };
}

module.exports = { calculateClassifications };