const fs = require("fs");
const csv = require("csv-parser");

let riskTable = [];

fs.createReadStream("RiskPredictionChartOceania.csv")
    .pipe(csv())
    .on("data", (row) => riskTable.push(row))
    .on("end", () => {
        console.log("✅ CVD Risk CSV Loaded:", riskTable.length);
    });

// helpers
function roundAge(age) {
    if (age < 40) return 40;
    if (age < 50) return 50;
    if (age < 60) return 60;
    return 70;
}

function roundBP(bp) {
    if (bp < 120) return 120;
    if (bp < 140) return 140;
    if (bp < 160) return 160;
    if (bp < 180) return 180;
    return 180;
}

function roundChol(chol) {
    if (chol < 4) return 3.9;
    if (chol < 5) return 4;
    if (chol < 6) return 5;
    if (chol < 7) return 6;
    return 7;
}

function mapRiskLevel(level) {
    switch (Number(level)) {
        case 1: return 5;
        case 2: return 10;
        case 3: return 20;
        case 4: return 30;
        case 5: return 40;
        case 6: return 50;
        default: return null;
    }
}

function calculateCvdRisk(record) {
    const { age, gender, smoker, glucose, sysBP, cholesterol } = record;

    if (age == null || sysBP == null || cholesterol == null) return null;

    let chol = cholesterol;
    if (chol > 20) chol = chol / 38.67;

    const diabetic = (glucose === 1 || glucose > 7) ? 1 : 0;

    const match = riskTable.find(row =>
        row.regionCode === "oc" &&
        Number(row.diabetes) === diabetic &&
        row.gender === (gender === "male" ? "M" : "F") &&
        Number(row.smoker) === (smoker || 0) &&
        Number(row.age) === roundAge(age) &&
        Number(row.systolic) === roundBP(sysBP) &&
        Number(row.cholesterol) === roundChol(chol)
    );

    return match ? mapRiskLevel(match.riskLevelId) : null;
}

function enrichCvdRisk(record) {
    if (record.cvdRisk == null) {
        record.cvdRisk = calculateCvdRisk(record);
    }
    return record;
}

module.exports = {
    calculateCvdRisk,
    enrichCvdRisk
};