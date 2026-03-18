const e = require("express");
const { get } = require("./fhirAxiosClient");
const { reverseCodeMap } = require("../../controllers/priorDxController");
const { buildWHOGuidance, buildPersonalSummary } = require("./helperService");
const util = require("util");


function val(v) {
  return v ?? "--";
}

function calculateAge(birthDate) {

  if (!birthDate) return "--";

  const today = new Date();
  const dob = new Date(birthDate);

  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }

  return age;
}

function getObservation(entries, code) {

  const observations = entries
    .filter(e => e.resource?.resourceType === "Observation")
    .map(e => e.resource);

  for (const obs of observations) {

    if (obs.code?.coding?.some(c => c.code === code)) {

      // if components exist → return all
      if (obs.component?.length) {
        return obs.component
          .map(c => ({
            value: c.valueQuantity?.value,
            unit: c.valueQuantity?.unit
          }))
          .filter(v => v.value !== undefined);
      }

      // single value
      if (obs.valueQuantity) {
        return [{
          value: obs.valueQuantity.value,
          unit: obs.valueQuantity.unit
        }];
      }
    }
  }

  return [];
}
function formatHeight(entries) {

  const values = getObservation(entries, "8302-2");

  const ft = values.find(v => v.unit === "ft")?.value;
  const inch = values.find(v => v.unit === "in")?.value;
  const cm = values.find(v => v.unit === "cm")?.value;

  if (cm) return `${cm} cm`;

  if (ft !== undefined)
    return inch === undefined ? `${ft} ft` : `${ft} ft ${inch} in`;

  return "--";
}
function formatWeight(entries) {

  const values = getObservation(entries, "29463-7");

  if (!values.length) return "--";

  return `${values[0].value} ${values[0].unit}`;
}
function formatCholesterol(entries) {

  const values = getObservation(entries, "2093-3");

  if (!values.length) return "--";

  return `${values[0].value} ${values[0].unit}`;
}
function formatBMI(value) {

  if (!value) return "--";

  let status = "";

  if (value < 18.5) status = "Underweight";
  else if (value < 25) status = "Normal";
  else if (value < 30) status = "Overweight";
  else status = "Obese";

  return `${value} (${status})`;
}
function getBloodPressure(entries) {

  const observations = entries
    .filter(e => e.resource?.resourceType === "Observation")
    .map(e => e.resource);

  const bpObs = observations.find(o =>
    o.code?.coding?.some(c => c.code === "35094-2")
  );

  if (!bpObs) return "--";

  const systolic = bpObs.component?.find(c =>
    c.code?.coding?.some(cd => cd.code === "8480-6")
  )?.valueQuantity?.value;

  const diastolic = bpObs.component?.find(c =>
    c.code?.coding?.some(cd => cd.code === "8462-4")
  )?.valueQuantity?.value;

  if (!systolic || !diastolic) return "--";

  return `${systolic}/${diastolic} mmHg`;
}
function getSmoking(entries) {

  const smoking = getObservation(entries, "72166-2");

  if (!smoking.length) return 0;

  return smoking[0].value === 1 ? 1 : 0;
}
function getDiabetes(entries) {

  const diabetes = getObservation(entries, "33248-6");

  if (!diabetes.length) return 0;

  return diabetes[0].value === 1 ? 1 : 0;
}
function getSystolic(entries) {

  const observations = entries
    .filter(e => e.resource?.resourceType === "Observation")
    .map(e => e.resource);

  const bpObs = observations.find(o =>
    o.code?.coding?.some(c => c.code === "35094-2")
  );

  if (!bpObs) return null;

  return bpObs.component?.find(c =>
    c.code?.coding?.some(cd => cd.code === "8480-6")
  )?.valueQuantity?.value || null;
}
function calculateRisk(entries, patient) {

  const age = calculateAge(patient?.birthDate);
  const gender = patient?.gender === "male" ? "M" : "F";

  const systolic = getSystolic(entries);
  const cholesterol = getObservation(entries, "2093-3")[0]?.value;
  const bmi = getObservation(entries, "9156-5")[0]?.value;

  const smoker = getSmoking(entries);
  const diabetes = getDiabetes(entries);

  let score = 0;

  // Age
  if (age >= 70) score += 4;
  else if (age >= 60) score += 3;
  else if (age >= 50) score += 2;
  else if (age >= 40) score += 1;

  // Blood pressure
  if (systolic >= 180) score += 4;
  else if (systolic >= 160) score += 3;
  else if (systolic >= 140) score += 2;
  else if (systolic >= 120) score += 1;

  // Cholesterol
  if (cholesterol >= 7) score += 3;
  else if (cholesterol >= 6) score += 2;
  else if (cholesterol >= 5) score += 1;

  // BMI
  if (bmi >= 35) score += 3;
  else if (bmi >= 30) score += 2;
  else if (bmi >= 25) score += 1;

  // Smoking
  if (smoker) score += 2;

  // Diabetes
  if (diabetes) score += 2;

  // Gender adjustment
  if (gender === "M") score += 1;

  const riskPercent = Math.min(score * 2, 40);

  let status = "Low risk";

  if (riskPercent >= 20) status = "High risk";
  else if (riskPercent >= 10) status = "Moderate risk";

  return {
    riskPrediction: `${riskPercent}%`,
    riskStatus: status
  };
}
function buildRiskStatus(entries, patient) {

  const gender = patient?.gender === "male" ? "M" : "F";
  const age = calculateAge(patient?.birthDate);

  const diabetes = getDiabetes(entries);
  const smoking = getSmoking(entries);

  const heartHistory = getObservation(entries, "78941-2")[0]?.value === 1;

  const diabetesText = diabetes ? "diabetic" : "non-diabetic";
  const smokingText = smoking ? "tobacco user" : "non tobacco user";

  const heartText = heartHistory
    ? "with a history of heart attack or stroke"
    : "without a history of heart attack or stroke";

  return `${gender}/${age}, ${diabetesText}, ${smokingText}, ${heartText}`;
}
function getVital(entries, text) {

  const observations = entries
    .filter(e => e.resource?.resourceType === "Observation")
    .map(e => e.resource);

  const obs = observations.find(o =>
    o.category?.some(c =>
      c.coding?.some(cd => cd.code === "Vital")
    ) &&
    o.component?.some(c => c.code?.text === text)
  );

  if (!obs) return "--";

  const component = obs.component.find(c => c.code?.text === text);

  if (!component) return "--";

  if (component.valueQuantity)
    return `${component.valueQuantity.value} ${component.valueQuantity.unit}`;

  if (component.valueString)
    return component.valueString;

  if (component.valueCodeableConcept?.text)
    return component.valueCodeableConcept.text;

  return "--";
}
function getGlucose(entries) {

  const observations = entries
    .filter(e => e.resource?.resourceType === "Observation")
    .map(e => e.resource);

  const obs = observations.find(o =>
    o.component?.some(c => c.code?.text === "Blood glucose")
  );

  if (!obs) return "--";

  const comp = obs.component.find(c => c.code?.text === "Blood glucose");

  if (!comp?.valueQuantity) return "--";

  const type = obs.code?.coding?.[0]?.display || "";

  return `${comp.valueQuantity.value} ${comp.valueQuantity.unit} (${type})`;
}
function getPriorDiagnosis(entries) {

  const conditions = entries
    .filter(e => e.resource?.resourceType === "Condition")
    .map(e => e.resource);

  if (!conditions.length) return "--";

  const diagnosisList = [];

  conditions.forEach(condition => {

    const coding = condition.code?.coding?.[0];

    if (!coding?.userSelected) return;
    const match = Object.values(reverseCodeMap)
      .find(item => item.code === coding.code);

    if (match) {
      diagnosisList.push(match.display);
    }

  });

  return diagnosisList.length ? diagnosisList.join(", ") : "--";
}
function buildQuestionnaireMap(entries, linkId) {

  const questionnaires = entries
    .filter(e => e.resource?.resourceType === "Questionnaire")
    .map(e => e.resource);
  for (const questionnaire of questionnaires) {

    const item = questionnaire.item?.find(i => i.linkId === linkId);

    if (item?.answerOption) {

      const map = {};

      item.answerOption.forEach(opt => {
        const coding = opt.valueCoding;
        map[coding.code] = coding.display;
      });
      return map;
    }
  }

  return {};
}
function getCurrentQuestionnaire(entries) {

  const encounter = entries
    .find(e => e.resource?.resourceType === "Encounter" && e.resource.reasonCode)
    ?.resource;

  const encounterId = encounter?.id;

  if (!encounterId) return null;

  return entries
    .filter(e => e.resource?.resourceType === "QuestionnaireResponse")
    .map(e => e.resource)
    .find(q => q.encounter?.reference === `Encounter/${encounterId}`);
}

function getPrescribedMedication(entries) {

  const response = entries
    .filter(e => e.resource?.resourceType === "QuestionnaireResponse")
    .map(e => e.resource)
    .filter(r => r.item?.some(i => i.linkId === "medicinePrescribed"))
    .sort((a, b) => new Date(b.meta?.lastUpdated) - new Date(a.meta?.lastUpdated))[0];

  if (!response) return "--";

  const codeMap = buildQuestionnaireMap(entries, "medicinePrescribed");

  const codes = response.item
    .find(i => i.linkId === "medicinePrescribed")
    ?.answer?.map(a => a.valueCoding?.code) || [];

  const meds = codes
    .map(code => codeMap[code])
    .filter(Boolean);

  const others = response.item
    .find(i => i.linkId === "medicinePrescribedOthers")
    ?.answer?.[0]?.valueString;

  if (others) meds.push(others);

  return meds.length ? meds.join(", ") : "--";
}
function getSideEffects(entries) {

  const response = entries
    .filter(e => e.resource?.resourceType === "QuestionnaireResponse")
    .map(e => e.resource)
    .filter(r => r.item?.some(i => i.linkId === "sideEffects"))
    .sort((a, b) => new Date(b.meta?.lastUpdated) - new Date(a.meta?.lastUpdated))[0];

  if (!response) return "--";

  const hasSideEffect = response.item
    ?.find(i => i.linkId === "sideEffects")
    ?.answer?.[0]?.valueBoolean;

  if (!hasSideEffect) return "--";

  const text = response.item
    ?.find(i => i.linkId === "sideEffectsText")
    ?.answer?.[0]?.valueString;

  return text || "Yes";
}
function getAdherence(entries) {

  const response = entries
    .filter(e => e.resource?.resourceType === "QuestionnaireResponse")
    .map(e => e.resource)
    .filter(r => r.item?.some(i => i.linkId === "Adherence"))
    .sort((a, b) => new Date(b.meta?.lastUpdated) - new Date(a.meta?.lastUpdated))[0];

  if (!response) return "--";

  const codeMap = buildQuestionnaireMap(entries, "Adherence");

  const code = response.item
    .find(i => i.linkId === "Adherence")
    ?.answer?.[0]?.valueCoding?.code;

  return codeMap[code] || "--";
}
function getFamilyHistory(entries) {

  const response = entries
    .filter(e => e.resource?.resourceType === "QuestionnaireResponse")
    .map(e => e.resource)
    .filter(r => r.item?.some(i => i.linkId === "familyDiseaseDetail"))
    .sort((a, b) => new Date(b.meta?.lastUpdated) - new Date(a.meta?.lastUpdated))[0];

  if (!response) return "--";

  const codeMap = buildQuestionnaireMap(entries, "familyDiseaseDetail");

  const codes = response.item
    .find(i => i.linkId === "familyDiseaseDetail")
    ?.answer?.map(a => a.valueCoding?.code) || [];

  const diseases = codes.map(code => {
    return codeMap[code] || code;
  });

  const earlyAge = response.item
    .find(i => i.linkId === "occurrenceAgeBoolean")
    ?.answer?.[0]?.valueCoding?.code;

  let text = diseases.join(", ");

  if (earlyAge === "yes") {
    text += " (before age 50)";
  }
  return text || "--";
}
function getAllergies(entries) {

  const allergies = entries
    .filter(e => e.resource?.resourceType === "AllergyIntolerance")
    .map(e => e.resource);

  const texts = [];

  allergies.forEach(a => {
    a.note?.forEach(n => {
      if (n.text) texts.push(n.text);
    });
  });

  return texts.length ? texts.join(", ") : "--";
}
function getRiskAnswer(entries, sectionId, questionId) {

  const response = entries
    .filter(e => e.resource?.resourceType === "QuestionnaireResponse")
    .map(e => e.resource)
    .find(r => r.item?.some(i => i.linkId === sectionId));

  if (!response) return "--";

  const section = response.item.find(i => i.linkId === sectionId);
  if (!section?.item) return "--";

  const question = section.item.find(i => i.linkId === questionId);
  if (!question?.answer?.length) return "--";

  const ans = question.answer[0];

  if (ans.valueBoolean !== undefined) {
    return ans.valueBoolean ? "Yes" : "No";
  }

  return ans.valueString ??
    ans.valueInteger ??
    ans.valueCoding?.display ??
    ans.valueCoding?.code ??
    "--";
}
function getRiskFactors(entries) {

  return {

    tobacco: {
      tobaccoUser: getRiskAnswer(entries, "tobacco", "tobaccoUser"),
      productUsed: getRiskAnswer(entries, "tobacco", "tobaccoItemType"),
      startAge: getRiskAnswer(entries, "tobacco", "startAge"),
      dailyUse: getRiskAnswer(entries, "tobacco", "consumptionAmount"),
      consumptionUnit: getRiskAnswer(entries, "tobacco", "consumptionUnit"),
      willingToQuit: getRiskAnswer(entries, "tobacco", "willingToQuit")
    },

    alcohol: {
      consumedWithin30Days: getRiskAnswer(entries, "alcohol", "consumedWithin30Days"),
      drinkOccasion: getRiskAnswer(entries, "alcohol", "alcoholQ1"),
      drinksPerOccasion: getRiskAnswer(entries, "alcohol", "alcoholQ2"),
      sixOrMoreDrinks: getRiskAnswer(entries, "alcohol", "alcoholQ3")
    },

    fruitsVegetables: {
      eatWeekly: getRiskAnswer(entries, "fruitsVegetables", "consumptionInWeek"),
      fruitsDays: getRiskAnswer(entries, "fruitsVegetables", "fruitsDays"),
      fruitServings: getRiskAnswer(entries, "fruitsVegetables", "fruitServings"),
      vegDays: getRiskAnswer(entries, "fruitsVegetables", "vegetableDays"),
      vegServings: getRiskAnswer(entries, "fruitsVegetables", "vegetableServings")
    },

    physicalActivity: {
      weeklyEngagement: getRiskAnswer(entries, "physicalActivity", "weeklyEngagement"),
      vigorousDays: getRiskAnswer(entries, "physicalActivity", "vigorousDays"),
      vigorousTime: getRiskAnswer(entries, "physicalActivity", "vigorousTime"),
      moderateDays: getRiskAnswer(entries, "physicalActivity", "moderateDays"),
      moderateTime: getRiskAnswer(entries, "physicalActivity", "moderateTime")
    },

    salt: {
      saltAmount: getRiskAnswer(entries, "salt", "saltAmount"),
      saltAddMeal: getRiskAnswer(entries, "salt", "saltAddMeal"),
      saltAddCooking: getRiskAnswer(entries, "salt", "saltAddCooking"),
      processedFood: getRiskAnswer(entries, "salt", "saltProcessedFood")
    },

    fats: {
      oilUsed: getRiskAnswer(entries, "fatAndOil", "oilUsed"),
      fatFoodFrequency: getRiskAnswer(entries, "fatAndOil", "fatFoodFrequency"),
      otherFat: getRiskAnswer(entries, "fatAndOil", "otherFatAndOils")
    },

    sugar: {
      softDrink: getRiskAnswer(entries, "sugar", "softDrinkFrequency"),
      juice: getRiskAnswer(entries, "sugar", "juiceFrequency")
    },

    mealsOutside: {
      eatsOut: getRiskAnswer(entries, "mealsOutsideHome", "eatsOut"),
      mealsPerWeek: getRiskAnswer(entries, "mealsOutsideHome", "mealsPerWeek")
    }

  };

}
function getTobaccoCessation(entries) {

  const response = entries
    .filter(e => e.resource?.resourceType === "QuestionnaireResponse")
    .map(e => e.resource)
    .find(r => r.item?.some(i => i.linkId === "tobaccoUse"));

  if (!response) {
    return {
      tobaccoUse: "--",
      briefAdvice: "--",
      assessedStatus: "--",
      assistQuit: "--",
      pharmacotherapy: "--",
      dateOfPlan: "--",
      planStatus: "--"
    };
  }

  const getItem = (id) =>
    response.item?.find(i => i.linkId === id)?.answer?.[0];

  const tobaccoCode = getItem("tobaccoUse")?.valueCoding?.code;

  const tobaccoUseMap = {
    "1": "Yes, every day",
    "2": "Yes, sometimes",
    "3": "No"
  };

  const assistMap = {
    "1": "Yes",
    "2": "No"
  };

  const planStatusMap = {
    "1": "Active",
    "2": "Not started",
    "3": "Completed"
  };

  return {

    tobaccoUse: tobaccoUseMap[tobaccoCode] || "--",

    briefAdvice:
      getItem("briefAdvice")?.valueBoolean === true ? "Yes" : "No",

    assessedStatus:
      getItem("assessedStatus")?.valueBoolean === true ? "Yes" : "No",

    assistQuit:
      assistMap[getItem("assistQuit")?.valueCoding?.code] || "--",

    pharmacotherapy:
      getItem("pharmacotherapy")?.valueBoolean === true ? "Yes" : "--",

    dateOfPlan:
      getItem("dateOfPlan")?.valueDate
        ? new Date(getItem("dateOfPlan").valueDate).toLocaleDateString("en-GB")
        : "--",

    planStatus:
      planStatusMap[getItem("planStatus")?.valueCoding?.code] || "--"
  };
}
function getDiagnosis(entries) {

  const conditions = entries
    .filter(e => e.resource?.resourceType === "Condition")
    .map(e => e.resource)
    .filter(c =>
      c.category?.some(cat =>
        cat.coding?.some(cd => cd.code === "diagnosis")
      )
    )
    .sort((a, b) => new Date(b.meta?.lastUpdated) - new Date(a.meta?.lastUpdated));

  if (!conditions.length) return "--";

  const diagnosis = conditions
    .map(c => c.code?.coding?.[0]?.display)
    .filter(Boolean);

  return diagnosis.length ? diagnosis.join("<br/><br/>") : "--"; // join but in next line to avoid long string in code
}
function resolveMedicationName(m, entries) {

  if (m.medicationCodeableConcept) {
    return (
      m.medicationCodeableConcept?.coding?.[0]?.display ||
      m.medicationCodeableConcept?.text ||
      "Unknown"
    );
  }

  if (m.medicationReference?.reference) {

    const ref = m.medicationReference.reference;

    const med = entries.find(
      e =>
        e.resource?.resourceType === "Medication" &&
        `Medication/${e.resource.id}` === ref
    )?.resource;

    if (med) {
      return (
        med.code?.coding?.[0]?.display ||
        med.code?.text ||
        "Unknown"
      );
    }
  }

  return "Unknown";
}


function getMedicationDetails(entries) {

  const meds = entries
    .filter(e => e.resource?.resourceType === "MedicationRequest")
    .map(e => e.resource)
    .sort((a, b) => new Date(b.meta?.lastUpdated) - new Date(a.meta?.lastUpdated));

  if (!meds.length) return [];

  return meds.map(m => {

    const dosage = m.dosageInstruction?.[0];
    const timing = dosage?.timing?.repeat;
    const dose = dosage?.doseAndRate?.[0]?.doseQuantity;

    return {
      name: resolveMedicationName(m, entries),

      dose: dose
        ? {
          value: dose.value,
          unit: dose.unit || null
        }
        : null,

      frequency: timing
        ? {
          frequency: timing.frequency || null,
          period: timing.period || null,
          unit: timing.periodUnit || null
        }
        : null,

      duration: timing?.period
        ? {
          value: timing.period,
          unit: timing.boundsDuration?.unit || "days"
        }
        : null,

      instruction:
        dosage?.additionalInstruction?.[0]?.coding?.[0]?.display || null,

      note: m.note?.[0]?.text || null,

      status: m.status === "completed" ? "Prescribed" : m.status || null
    };

  });
}
function buildMedicationHTML(medications) {

  if (!medications?.length) return "";

  return medications.map(med => {

    const dose = med.dose || {};
    const frequency = med.frequency || {};
    const duration = med.duration || {};

    // ✅ Build line 1 (dose + frequency)
    const line1Parts = [];

    if (dose.value) {
      line1Parts.push(`${dose.value} ${dose.unit || ""}`.trim());
    }

    if (frequency.frequency && frequency.period) {
      line1Parts.push(`${frequency.frequency}/${frequency.period}${frequency.unit || ""}`);
    }

    const line1 = line1Parts.join(", ");

    // ✅ Build line 2 (duration + instruction)
    const line2Parts = [];

    if (duration.value) {
      line2Parts.push(`${duration.value} ${duration.unit || ""}`.trim());
    }

    if (med.instruction) {
      line2Parts.push(med.instruction);
    }

    const line2 = line2Parts.join(", ");

    return `
      <div style="margin-bottom:10px;">

          <div class="value">${med.name || ""}</div>

          ${line1 ? `<div class="value2">${line1}</div>` : ""}

          ${line2 ? `<div class="value2">${line2}</div>` : ""}

          ${med.status ? `<div class="value3">${med.status}</div>` : ""}

      </div>
    `;
  }).join("");
}
function buildActivityDefinitionMap(entries) {

  const map = {};

  entries
    .filter(e => e.resource?.resourceType === "ActivityDefinition")
    .forEach(e => {
      const r = e.resource;

      map[r.id] = r.name || "Unknown";
    });

  return map;
}
function getServiceRequestDetails(entries) {

  const activityMap = buildActivityDefinitionMap(entries);

  return entries
    .filter(e => e.resource?.resourceType === "ServiceRequest")
    .map(e => e.resource)
    .filter(s =>
      s.category?.some(c =>
        c.coding?.some(cd => cd.code === "10825200")
      )
    )
    .map(s => ({

      id: s.id,

      category: s.category?.[0]?.coding?.[0]?.display,

      status: s.status,

      date: s.occurrenceDateTime
        ? new Date(s.occurrenceDateTime).toLocaleDateString("en-GB")
        : "--",

      activities: (s.instantiatesCanonical || []).map(ref => {
        const id = ref.split("/")[1];
        return activityMap[id] || ref;
      })

    }));
}
function buildServiceRequestHTML(services) {

  if (!services.length) return "--";

  return services.map(s => `
    <div style="margin-bottom:10px;">

        <div class="value">
            ${s.activities.join("<br/>")}
        </div>

        <div class="value3">
            ${s.status.charAt(0).toUpperCase() + s.status.slice(1)}
        </div>

    </div>
  `).join("");
}
function buildOrganizationMap(entries) {

  const map = {};

  entries
    .filter(e => e.resource?.resourceType === "Organization")
    .forEach(e => {
      const org = e.resource;
      map[org.id] = org.name || "Unknown Facility";
    });

  return map;
}
function getHealthFacility(entries) {

  const orgMap = {};

  // Build Organization map
  entries
    .filter(e => e.resource?.resourceType === "Organization")
    .forEach(e => {
      orgMap[e.resource.id] = e.resource.name;
    });

  // 👇 Find ROOT encounter (no partOf OR has serviceProvider)
  const encounter = entries
    .filter(e => e.resource?.resourceType === "Encounter")
    .map(e => e.resource)
    .find(enc => enc.serviceProvider); // ✅ key fix

  if (!encounter?.serviceProvider?.reference) return "--";

  const orgId = encounter.serviceProvider.reference.split("/")[1];

  return orgMap[orgId] || "--";
}
function getInterventionDetails(entries) {

  const activityMap = buildActivityDefinitionMap(entries);

  return entries
    .filter(e => e.resource?.resourceType === "ServiceRequest")
    .map(e => e.resource)
    .filter(s =>
      s.category?.some(c =>
        c.coding?.some(cd => cd.code === "409073007")
      )
    )
    .map(s => ({

      id: s.id,

      status: s.status,

      date: s.occurrenceDateTime
        ? new Date(s.occurrenceDateTime).toLocaleDateString("en-GB")
        : "--",

      activities: (s.instantiatesCanonical || []).map(ref => {
        const id = ref.split("/")[1];
        return activityMap[id] || ref;
      })

    }));
}
function buildInterventionHTML(interventions) {

  if (!interventions.length) return "--";

  return interventions.map(i => `
    <div style="margin-bottom:10px;">

        <div class="value">
            ${i.activities.join("<br/>")}
        </div>

        <div class="value3">
            ${i.status.charAt(0).toUpperCase() + i.status.slice(1)}
        </div>

    </div>
  `).join("");
}
function buildReport(entries) {
  console.log(
    entries
      .filter(e => e.resource?.resourceType === "ServiceRequest")
      .map(e => e.resource.category)
  );
  const patient = entries.find(
    e => e.resource?.resourceType === "Patient"
  )?.resource;

  const observation = entries
    .filter(e => e.resource?.resourceType === "Observation")
    .map(e => e.resource)
    .sort((a, b) => new Date(b.effectiveDateTime) - new Date(a.effectiveDateTime))[0];
  const chiefComplaint = entries
    .filter(e => e.resource?.resourceType === "Encounter")
    .filter(e => e.resource.reasonCode)
    .map(e => e.resource)
    .sort((a, b) => new Date(b.meta?.lastUpdated) - new Date(a.meta?.lastUpdated))[0];
  const name = [
    ...(patient?.name?.[0]?.given || []),
    patient?.name?.[0]?.family || ""
  ].join(" ").trim();
  const risk = calculateRisk(entries, patient);
  const heartcareId = patient?.identifier?.find(
    id =>
      id.system === "https://heartcare.gov.vu/dashboard/patient-info" &&
      id.value
  )?.value;
  const bmiObs = getObservation(entries, "9156-5");
  const bmiValue = bmiObs?.[0]?.value;
  const riskStatusText = buildRiskStatus(entries, patient);

  const meds = getMedicationDetails(entries);
  const services = getServiceRequestDetails(entries);
  const interventions = getInterventionDetails(entries);
  console.log("Medications:", meds);
  console.log("Services:", services);
  console.log("Interventions:", interventions);
  console.log("Health Facility:", getHealthFacility(entries));
  let report = {

    heartcareId: val(heartcareId),

    name: val(name),

    gender: val(patient?.gender),

    age: calculateAge(patient?.birthDate),

    visitDate: observation?.effectiveDateTime
      ? new Date(observation.effectiveDateTime).toLocaleDateString("en-GB")
      : "--",

    riskPrediction: `${risk.riskPrediction} - ${risk.riskStatus}`,

    riskStatus: riskStatusText,

    weight: formatWeight(entries),

    height: formatHeight(entries),

    bp: getBloodPressure(entries),

    cholesterol: formatCholesterol(entries),

    bmi: bmiValue === undefined ? "--"
      : formatBMI(bmiValue),

    chiefComplaint: chiefComplaint?.reasonCode?.[0]?.text || "--",

    glucose: getGlucose(entries),

    abdominal: getVital(entries, "Abdominal circumference"),

    creatinine: getVital(entries, "Serum creatinine"),

    foot: getVital(entries, "Foot examination"),

    hip: getVital(entries, "Hip circumference"),

    potassium: getVital(entries, "Serum potassium"),

    eye: getVital(entries, "Eye examination"),

    hba1c: getVital(entries, "HbA1c"),

    urineKetone: getVital(entries, "Urine ketones"),

    priorDiagnosis: getPriorDiagnosis(entries),

    familyHistory: getFamilyHistory(entries),

    adherence: getAdherence(entries),

    sideEffects: getSideEffects(entries),

    allergies: getAllergies(entries),

    prescribedMedication: getPrescribedMedication(entries),

    // Risk factor
    riskFactors: getRiskFactors(entries),

    tobaccoCessation: getTobaccoCessation(entries),

    notes: getMedicationDetails(entries).map(m => m.note).filter(Boolean).join("<br/><br/>") || "--",

    diagnosis: getDiagnosis(entries),

    medication: buildMedicationHTML(meds),

    examination: buildServiceRequestHTML(services),
    intervention: buildInterventionHTML(interventions),
    facility: getHealthFacility(entries)

  };
  report.guidance = buildWHOGuidance(report);
  report.personalSummary = buildPersonalSummary(report);
  return report;

}

module.exports = { buildReport };