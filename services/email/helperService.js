function buildWHOGuidance(report) {

  const g = {};

  // -------------------------
  // Blood Pressure (WHO HEARTS)
  // -------------------------
  if (report.bp !== "--") {
    const [sys, dia] = report.bp.split(" ")[0].split("/").map(Number);

    if (sys >= 140 || dia >= 90) {
      g.bp = `Hypertension (${sys}/${dia} mmHg), target below 140/90 mmHg. Start or adjust treatment.`;
    } else if (sys >= 120 || dia >= 80) {
      g.bp = `Prehypertension (${sys}/${dia} mmHg), target below 120/80 mmHg. Lifestyle modification advised.`;
    } else {
      g.bp = `Normal blood pressure (${sys}/${dia} mmHg). Maintain healthy lifestyle.`;
    }
  } else {
    g.bp = `Blood pressure not recorded. Please measure.`;
  }

  // -------------------------
  // Blood Glucose (WHO Diabetes)
  // -------------------------
  if (report.glucose !== "--") {
    if (report.hba1c !== "--") {
      g.glucose = `Diabetes detected. Maintain HbA1c <7%. Monitor fasting glucose (70–125 mg/dL).`;
    } else {
      g.glucose = `Monitor blood glucose. Target fasting glucose 70–125 mg/dL.`;
    }
  } else {
    g.glucose = `Blood glucose not checked. Test recommended.`;
  }

  // -------------------------
  // Cholesterol
  // -------------------------
  if (report.cholesterol !== "--") {
    g.cholesterol = `Maintain total cholesterol <5 mmol/L. Consider statin if high risk.`;
  } else {
    g.cholesterol = `Cholesterol test not done. Perform lipid profile.`;
  }

  // -------------------------
  // BMI / Weight
  // -------------------------
  if (report.bmi !== "--") {
    const bmiValue = Number.parseFloat(report.bmi);

    if (bmiValue >= 25) {
      g.weight = `Overweight (BMI ${bmiValue}). Advise weight reduction, diet, and exercise.`;
    } else {
      g.weight = `Normal body weight (BMI ${bmiValue}). Maintain healthy lifestyle.`;
    }
  }

  // -------------------------
  // Tobacco
  // -------------------------
  if (report.riskFactors.tobacco.tobaccoUser === "Yes") {
    g.tobacco = `Currently uses tobacco. Strongly advise quitting, provide counselling and pharmacotherapy if needed.`;
  } else {
    g.tobacco = `No tobacco use. Reinforce avoidance.`;
  }

  // -------------------------
  // Alcohol
  // -------------------------
  if (report.riskFactors.alcohol.consumedWithin30Days === "Yes") {
    g.alcohol = `Alcohol consumption present. Advise reduction or cessation.`;
  } else {
    g.alcohol = `No alcohol consumption.`;
  }

  // -------------------------
  // Physical Activity
  // -------------------------
  if (report.riskFactors.physicalActivity.weeklyEngagement === "No") {
    g.activity = `Low physical activity. Recommend ≥150 minutes/week moderate exercise.`;
  } else {
    g.activity = `Adequate physical activity. Maintain routine.`;
  }

  // -------------------------
  // Diet (Salt + Fruits)
  // -------------------------
  const fv = report.riskFactors.fruitsVegetables;

  if (!fv.fruitsDays || fv.fruitsDays === "--") {
    g.fruits = `Fruit and vegetable patterns were not checked. Assess intake.`;
  } else if (fv.fruitServings >= 5) {
    g.fruits = `Adequate fruit and vegetable intake. Maintain ≥5 servings/day.`;
  } else {
    g.fruits = `Low fruit and vegetable intake. Increase to at least 5 servings/day.`;
  }
  const salt = report.riskFactors.salt;

  if (!salt.saltAmount || salt.saltAmount === "--") {
    g.salt = `Salt intake not assessed.`;
  } else if (salt.saltAmount <= 5) {
    g.salt = `Salt intake is within recommended limits (<5g/day).`;
  } else {
    g.salt = `High salt intake detected. Reduce intake to less than 5g/day.`;
  }

  // -------------------------
  // Cardiovascular Risk
  // -------------------------
  if (report.riskPrediction.includes("High")) {
    g.cvd = `High cardiovascular risk. Start statins, consider aspirin, and ensure close follow-up.`;
  } else if (report.riskPrediction.includes("Moderate")) {
    g.cvd = `Moderate cardiovascular risk. Lifestyle modification and monitoring required.`;
  } else {
    g.cvd = `Low cardiovascular risk. Maintain preventive lifestyle.`;
  }

  return g;
}
function buildPersonalSummary(report) {

  const s = {};

  // ---------------- Cardiovascular Risk ----------------
  if (report.riskPrediction.includes("High")) {
    s.cardioVascularRisk = `You are at high risk of developing a heart attack or stroke. 
Consult with your doctor on how you can reduce your risk of a future cardiovascular disease event.`;
  } else {
    s.cardioVascularRisk = `You have a low risk of cardiovascular disease. Maintain a healthy lifestyle.`;
  }

  // ---------------- Blood Pressure ----------------
  if (report.bp !== "--") {
    const [sys, dia] = report.bp.split(" ")[0].split("/").map(Number);

    if (sys >= 120 || dia >= 80) {
      s.bloodPressure = `Your blood pressure is slightly higher than the normal range (120/80 mmHg). 
Maintain blood pressure below 120/80 mmHg. Reduce salt intake and exercise regularly.`;
    } else {
      s.bloodPressure = `Your blood pressure is normal. Keep maintaining a healthy lifestyle.`;
    }
  }

  // ---------------- Blood Glucose ----------------
  if (report.glucose !== "--") {
    s.bloodGlucose = `Your blood glucose is poorly controlled (${report.glucose}). 
Maintain fasting blood glucose at 70-125 mg/dL.`;
  }

  // ---------------- Body Weight ----------------
  if (report.bmi !== "--") {
    const bmiValue = parseFloat(report.bmi.split(" ")[0]);

    if (bmiValue >= 25) {
      s.bodyWeight = `Your body weight is above normal. Try to reduce weight through diet and physical activity.`;
    } else {
      s.bodyWeight = `Your body weight is in normal range. Maintain a healthy diet and regular activity.`;
    }
  }

  // ---------------- Tobacco ----------------
  if (report.riskFactors.tobacco.tobaccoUser === "Yes") {
    s.tobaccoConsumption = `Tobacco use increases the risk of heart attack, stroke, lung cancer and respiratory diseases. 
Quitting tobacco is the most important step you can take for your health.`;
  }

  // ---------------- Alcohol ----------------
  if (report.riskFactors.alcohol.consumedWithin30Days === "Yes") {
    s.alcaholConsumption = `Reduce alcohol consumption for better health.`;
  } else {
    s.alcaholConsumption = `Continue to maintain a healthy drinking habit.`;
  }

  // ---------------- Fruits & Vegetables ----------------
  const fv = report.riskFactors.fruitsVegetables;

  if (!fv.fruitsDays || fv.fruitsDays === "--") {
    s.fruitsAndVegetables = `Fruit and vegetable patterns were not checked today. Ask your provider.`;
  } else {
    s.fruitsAndVegetables = `You consume fruits ${fv.fruitsDays} days/week and vegetables ${fv.vegDays} days/week. Continue a healthy diet (≥5 servings/day).`;
  }

  // ---------------- Salt ----------------
  const salt = report.riskFactors.salt;

  if (!salt.saltAmount || salt.saltAmount === "--") {
    s.saltIntake = `Salt intake patterns were not checked today.`;
  } else {
    s.saltIntake = `Your salt intake is ${salt.saltAmount}. WHO recommends less than 5g/day. Consider reducing salt intake.`;
  }

  // ---------------- Physical Activity ----------------
  const pa = report.riskFactors.physicalActivity;

  if (!pa.weeklyEngagement || pa.weeklyEngagement === "--") {
    s.physicalActivity = `Physical activity not assessed.`;
  } else {
    const totalMinutes = (Number(pa.moderateDays) || 0) * (Number(pa.moderateTime) || 0) + (Number(pa.vigorousDays) || 0) * (Number(pa.vigorousTime) || 0);

    if (totalMinutes >= 150) {
      s.physicalActivity = `You are physically active. Maintain at least 150 minutes/week.`;
    } else {
      s.physicalActivity = `Your physical activity is below recommended levels. Increase activity to at least 150 minutes/week.`;
    }
  }

  // ---------------- Cholesterol ----------------
  if (report.cholesterol !== "--") {
    s.totalCholestrol = `Your cholesterol level is ${report.cholesterol}. Maintain it below recommended levels.`;
  } else {
    s.totalCholestrol = `Cholesterol test not done.`;
  }

  return s;
}

module.exports = { buildWHOGuidance, buildPersonalSummary };