const bmiClassification = (bmi) =>  {
    if (bmi == null) return null;
    else if (bmi <= 18.5) return "underweight";
    else if (bmi > 18.5 && bmi < 25) return "normal";
    else if (bmi >= 25 && bmi < 30) return "overweight";
    else return "obese";
}

const bpClassification = (sysBP, diaBP) => {
    if (sysBP == null || diaBP == null) return null;
    else if (sysBP >= 180 || diaBP >= 120) return "veryHigh";
    else if (sysBP >= 160 || diaBP >= 100) return "high";
    else return "normal";
}

const glucoseClassification = (type, unit, value) => {
    if(value == null) return null;
    const finalValue = unit == "mmol/L" ? value : value / 18.0182;
    if(type == "fasting" && finalValue >= 6.1) return "aboveNormal";
    else if(type == "fasting" && finalValue < 6.1) return "normal";
    if(type == "random" && finalValue >= 11.1) return "aboveNormal";
    else if(type == "random" && finalValue < 11.1) return "normal";

}

const cholesterolClassification = (unit, value) => {
    if(value == null) return null;
    const finalValue = unit == "mmol/L" ? value : value / 18.0182;
    if(finalValue >= 5.2) return "aboveNormal";
    else return "normal"
}

const riskClassification = (value) => {
    if(value == null) return null;
    else if(value >= 30) return "veryHigh";
    else if(value >= 20) return "high"
    else if(value >= 10) return "medium"
    else return "low"
}


function birthdateToAge(birthdate) {
    const birth = new Date(birthdate);
    const today = new Date();
  
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
  
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
  
    return age;
  }

module.exports = {
    bmiClassification, bpClassification, glucoseClassification, cholesterolClassification, riskClassification, birthdateToAge
}