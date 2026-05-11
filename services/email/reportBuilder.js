require("./fhirAxiosClient");
const { reverseCodeMap } = require("../../controllers/priorDxController");
const { buildWHOGuidance, buildPersonalSummary } = require("./helperService");

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
  return age.toString();
}

const ENCOUNTER_TYPES = Object.freeze({
  SCREENING_SITE: "screening-site",
  FACILITY: new Set(["facility-main-encounter", "vital-test-encounter", "cvd-encounter", "priorDx-encounter", "symptom-diagnosis-encounter", "prescription-encounter-form", "facility"])
});

const RESOURCE_TYPES = Object.freeze({
  ENCOUNTER: "Encounter",
  OBSERVATION: "Observation",
  CONDITION: "Condition",
  QUESTIONNAIRE: "Questionnaire",
  QUESTIONNAIRE_RESPONSE: "QuestionnaireResponse",
  MEDICATION_REQUEST: "MedicationRequest",
  SERVICE_REQUEST: "ServiceRequest",
  ACTIVITY_DEFINITION: "ActivityDefinition",
  ORGANIZATION: "Organization"
});

function categorizeEntries(entries) {
  const result = {
    enc: [], obs: [], cond: [], qr: [], mr: [], sr: [], questionnaire: [], activity: [], org: []
  };
  entries.forEach(entry => {
    const type = entry?.resource?.resourceType;
    if (type === RESOURCE_TYPES.ENCOUNTER) result.enc.push(entry.resource);
    else if (type === RESOURCE_TYPES.OBSERVATION) result.obs.push(entry.resource);
    else if (type === RESOURCE_TYPES.CONDITION) result.cond.push(entry.resource);
    else if (type === RESOURCE_TYPES.QUESTIONNAIRE_RESPONSE) result.qr.push(entry.resource);
    else if (type === RESOURCE_TYPES.MEDICATION_REQUEST) result.mr.push(entry.resource);
    else if (type === RESOURCE_TYPES.SERVICE_REQUEST) result.sr.push(entry.resource);
    else if (type === RESOURCE_TYPES.QUESTIONNAIRE) result.questionnaire.push(entry.resource);
    else if (type === RESOURCE_TYPES.ACTIVITY_DEFINITION) result.activity.push(entry.resource);
    else if (type === RESOURCE_TYPES.ORGANIZATION) result.org.push(entry.resource);
  });
  return result;
}

function buildEncounterRefs(encounters) {
  const ids = encounters.map(e => String(e.id));
  return {
    allIds: ids,
    allIdSet: new Set(ids),
    refs: ids.map(id => `Encounter/${id}`)
  };
}

function filterByEncounterType(encounters, typeCode, isExact = false) {
  return encounters.filter(e =>
    e.type?.[0]?.coding?.some(c =>
      isExact ? c.code === typeCode : ENCOUNTER_TYPES.FACILITY.has(c.code)
    )
  ).map(e => `Encounter/${e.id}`);
}

function buildQuestionnaireMaps(questionnaires) {
  const maps = {};
  questionnaires.forEach(q => {
    q.item?.forEach(item => {
      if (!item.linkId || !item.answerOption) return;
      const map = {};
      item.answerOption.forEach(opt => {
        const coding = opt.valueCoding || opt.valueInteger;
        if (!coding) return;
        const code = coding.code === undefined ? code : coding.code;
        map[code] = coding.display === undefined ? code : coding.display;
      });
      if (Object.keys(map).length > 0) maps[item.linkId] = map;
    });
  });
  return maps;
}

function buildActivityMap(activityDefs) {
  const map = {};
  activityDefs.forEach(a => { map[a.id] = a.name || "Unknown"; });
  return map;
}

function buildOrgMap(orgs) {
  const map = {};
  orgs.forEach(o => { map[o.id] = o.name || "Unknown Facility"; });
  return map;
}

function filterScreeningSiteEncounters(encounters) {
  return encounters.filter(e =>
    e.type?.[0]?.coding?.some(c => c.code && c.code.includes(ENCOUNTER_TYPES.SCREENING_SITE))
  ).map(e => `Encounter/${e.id}`);
}

function buildEntryIndex(entries) {
  if (!entries || !Array.isArray(entries)) {
    return {
      byType: {}, encounterRefs: [], allEncounterIds: [], allEncounterIdSet: new Set(),
      screeningSiteEncounterRefs: [], facilityEncounterRefs: [], questionnaireCodeMaps: {},
      activityDefinitionMap: {}, organizationMap: {}, observations: [], conditions: [],
      questionnaireResponses: [], medicationRequests: [], serviceRequests: [], encounters: []
    };
  }

  const { enc, obs, cond, qr, mr, sr, questionnaire, activity, org } = categorizeEntries(entries);
  const { allIds, allIdSet, refs } = buildEncounterRefs(enc);

  return {
    byType: {}, encounterRefs: refs, allEncounterIds: allIds, allEncounterIdSet: allIdSet,
    screeningSiteEncounterRefs: filterScreeningSiteEncounters(enc),
    facilityEncounterRefs: filterByEncounterType(enc, null, false),
    questionnaireCodeMaps: buildQuestionnaireMaps(questionnaire),
    activityDefinitionMap: buildActivityMap(activity),
    organizationMap: buildOrgMap(org),
    observations: obs, conditions: cond, questionnaireResponses: qr,
    medicationRequests: mr, serviceRequests: sr, encounters: enc
  };
}

function filterByEncounter(resources, encounterRefs) {
  if (!encounterRefs?.length) return resources;
  const refSet = new Set(encounterRefs);
  return resources.filter(r => r.encounter?.reference && refSet.has(r.encounter.reference));
}

function getChiefComplaintById(encounters, allEncounterIds) {
  const ids = Array.isArray(allEncounterIds) ? allEncounterIds : [...allEncounterIds];
  const idSet = new Set(ids.map(String));
  const relevant = encounters.filter(e => e.reasonCode && idSet.has(String(e.id)));
  if (!relevant.length) return null;
  return relevant.sort((a, b) => new Date(b.meta?.lastUpdated) - new Date(a.meta?.lastUpdated))[0];
}

function extractValues(obs) {
  if (obs.component?.length) {
    const values = obs.component
      .map(comp => comp.valueQuantity)
      .filter(v => v?.value !== undefined)
      .map(v => ({ value: v.value, unit: v.unit }));
    return values;
  }
  if (obs.valueQuantity) {
    return [{ value: obs.valueQuantity.value, unit: obs.valueQuantity.unit }];
  }
  return [];
}

function getObservationByCode(observations, code, encounterRefs) {
  const filtered = filterByEncounter(observations, encounterRefs);
  for (const obs of filtered) {
    if (obs.code?.coding?.some(c => c.code === code)) {
      return extractValues(obs);
    }
  }
  return [];
}

function formatHeight(entries, ctx) {
  const values = getObservationByCode(ctx.observations, "8302-2", ctx.encounterRefs);
  const ft = values.find(v => v.unit === "ft")?.value;
  const inch = values.find(v => v.unit === "in")?.value;
  const cm = values.find(v => v.unit === "cm")?.value;
  if (cm) return `${cm} cm`;
  if (ft !== undefined) return inch === undefined ? `${ft} ft` : `${ft} ft ${inch} in`;
  return "--";
}

function formatWeight(entries, ctx) {
  const values = getObservationByCode(ctx.observations, "29463-7", ctx.encounterRefs);
  if (!values.length) return "--";
  return `${values[0].value} ${values[0].unit}`;
}

function formatCholesterol(entries, ctx) {
  const values = getObservationByCode(ctx.observations, "2093-3", ctx.encounterRefs);
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

function getBloodPressure(entries, ctx) {
  const filtered = filterByEncounter(ctx.observations, ctx.encounterRefs);
  const bpObs = filtered.find(o => o.code?.coding?.some(c => c.code === "35094-2"));
  if (!bpObs) return "--";
  const systolic = bpObs.component?.find(c => c.code?.coding?.some(cd => cd.code === "8480-6"))?.valueQuantity?.value;
  const diastolic = bpObs.component?.find(c => c.code?.coding?.some(cd => cd.code === "8462-4"))?.valueQuantity?.value;
  if (!systolic || !diastolic) return "--";
  return `${systolic}/${diastolic} mmHg`;
}

function getSmoking(entries, ctx) {
  const smoking = getObservationByCode(ctx.observations, "72166-2", ctx.encounterRefs);
  if (!smoking.length) return 0;
  return smoking[0].value === 1 ? 1 : 0;
}

function getDiabetes(entries, ctx) {
  const diabetes = getObservationByCode(ctx.observations, "33248-6", ctx.encounterRefs);
  if (!diabetes.length) return 0;
  return diabetes[0].value === 1 ? 1 : 0;
}

function buildRiskStatus(entries, patient, ctx) {
  const gender = patient?.gender === "male" ? "M" : "F";
  const age = calculateAge(patient?.birthDate);
  const diabetes = getDiabetes(entries, ctx);
  const smoking = getSmoking(entries, ctx);
  const heartHistory = getObservationByCode(ctx.observations, "78941-2", ctx.encounterRefs)[0]?.value === 1;
  if (diabetes == null || smoking == null || heartHistory == null || (diabetes === 0 && smoking === 0 && heartHistory === false)) {
    return `--`;
  }
  const diabetesText = diabetes ? "diabetic" : "non-diabetic";
  const smokingText = smoking ? "tobacco user" : "non tobacco user";
  const heartText = heartHistory ? "with a history of heart attack or stroke" : "without a history of heart attack or stroke";
  return `${gender}/${age}, ${diabetesText}, ${smokingText}, ${heartText}`;
}

function getVital(entries, text, ctx) {
  if (!ctx.observations) return "--";
  const filtered = filterByEncounter(ctx.observations, ctx.encounterRefs);
  const obs = filtered.find(o =>
    o.category?.some(c => c.coding?.some(cd => cd.code === "vital-signs" || cd.code === "Vital")) &&
    o.component?.some(c => c.code?.text === text)
  );
  if (!obs) return "--";
  const component = obs.component.find(c => c.code?.text === text);
  if (!component) return "--";
  if (component.valueQuantity) return `${component.valueQuantity.value} ${component.valueQuantity.unit}`;
  if (component.valueString) return component.valueString;
  if (component.valueCodeableConcept?.text) return component.valueCodeableConcept.text;
  return "--";
}

function getGlucose(entries, ctx) {
  if (!ctx.observations) return "--";
  const filtered = filterByEncounter(ctx.observations, ctx.encounterRefs);
  const obs = filtered.find(o => o.component?.some(c => c.code?.text === "Blood glucose"));
  if (!obs) return "--";
  const comp = obs.component.find(c => c.code?.text === "Blood glucose");
  if (!comp?.valueQuantity) return "--";
  const type = obs.code?.coding?.[0]?.display || "";
  return `${comp.valueQuantity.value} ${comp.valueQuantity.unit} (${type})`;
}

function getPriorDiagnosis(entries, ctx) {
  const filtered = filterByEncounter(ctx.conditions, ctx.encounterRefs);
  const diagnosisList = [];
  filtered.forEach(condition => {
    const coding = condition.code?.coding?.[0];
    if (!coding?.userSelected) return;
    const match = Object.values(reverseCodeMap).find(item => item.code === coding.code);
    if (match) diagnosisList.push(match.display);
  });
  return diagnosisList.length ? diagnosisList.join(", ") : "--";
}

function getLatestQuestionnaireResponse(responses, linkId, ctx) {
  const targetRefs = ctx.encounterRefs || [];
  const filtered = filterByEncounter(responses, targetRefs);
  const sorted = filtered
    .filter(r => r.item?.some(i => i.linkId === linkId))
    .sort((a, b) => new Date(b.meta?.lastUpdated) - new Date(a.meta?.lastUpdated));
  return sorted[0] || null;
}

function getPrescribedMedication(entries, ctx) {
  const response = getLatestQuestionnaireResponse(ctx.questionnaireResponses, "medicinePrescribed", ctx);
  if (!response) return "--";
  const codeMap = ctx.questionnaireCodeMaps["medicinePrescribed"] || {};
  const codes = response.item.find(i => i.linkId === "medicinePrescribed")?.answer?.map(a => a.valueCoding?.code) || [];
  const meds = codes.map(code => codeMap[String(code)] || codeMap[code]).filter(Boolean);
  const others = response.item.find(i => i.linkId === "medicinePrescribedOthers")?.answer?.[0]?.valueString;
  if (others) meds.push(others);
  return meds.length ? meds.join(", ") : "--";
}

function getSideEffects(entries, ctx) {
  const response = getLatestQuestionnaireResponse(ctx.questionnaireResponses, "sideEffects", ctx);
  if (!response) return "--";
  const hasSideEffect = response.item?.find(i => i.linkId === "sideEffects")?.answer?.[0]?.valueBoolean;
  if (!hasSideEffect) return "--";
  const text = response.item?.find(i => i.linkId === "sideEffectsText")?.answer?.[0]?.valueString;
  return text || "Yes";
}

function getAdherence(entries, ctx) {
  const response = getLatestQuestionnaireResponse(ctx.questionnaireResponses, "Adherence", ctx);
  if (!response) return "--";
  const codeMap = ctx.questionnaireCodeMaps["Adherence"] || {};
  const code = response.item.find(i => i.linkId === "Adherence")?.answer?.[0]?.valueCoding?.code;
  return codeMap[String(code)] || codeMap[code] || "--";
}

function getFamilyHistory(entries, ctx) {
  const response = getLatestQuestionnaireResponse(ctx.questionnaireResponses, "familyDiseaseDetail", ctx);
  if (!response) return "--";
  const codeMap = ctx.questionnaireCodeMaps["familyDiseaseDetail"] || {};
  const codes = response.item.find(i => i.linkId === "familyDiseaseDetail")?.answer?.map(a => a.valueCoding?.code) || [];
  const diseases = codes.map(code => codeMap[code] || code);
  const earlyAge = response.item.find(i => i.linkId === "occurrenceAgeBoolean")?.answer?.[0]?.valueCoding?.code;
  let text = diseases.join(", ");
  if (earlyAge === "yes") text += " (before age 50)";
  return text || "--";
}

function getAllergies(entries, ctx) {
  const targetRefs = ctx.encounterRefs || [];
  const allAllergies = entries.filter(e => e.resource?.resourceType === "AllergyIntolerance").map(e => e.resource);
  const filtered = allAllergies.filter(a => a.encounter?.reference && targetRefs.includes(a.encounter.reference));
  const texts = [];
  filtered.forEach(a => a.note?.forEach(n => { if (n.text) texts.push(n.text); }));
  return texts.length ? texts.join(", ") : "--";
}

function getRiskAnswer(responses, sectionId, questionId, ctx) {
  const targetRefs = new Set(ctx.encounterRefs || ctx.facilityEncounterRefs || []);
  const allResponses = (responses || []).filter(r => 
    r.encounter?.reference && targetRefs.has(r.encounter.reference)
  );
  const response = allResponses.find(r => r.item?.some(i => i.linkId === sectionId));
  if (!response) return "--";
  const section = response.item.find(i => i.linkId === sectionId);
  if (!section?.item) return "--";
  const question = section.item.find(i => i.linkId === questionId);
  if (!question?.answer?.length) return "--";
  const ans = question.answer[0];
  if (ans.valueBoolean !== undefined) return ans.valueBoolean ? "Yes" : "No";
  return ans.valueString ?? ans.valueInteger ?? ans.valueCoding?.display ?? ans.valueCoding?.code ?? "--";
}

function getRiskFactors(entries, ctx) {
  return {
    tobacco: {
      tobaccoUser: getRiskAnswer(ctx.questionnaireResponses, "tobacco", "tobaccoUser", ctx),
      productUsed: getRiskAnswer(ctx.questionnaireResponses, "tobacco", "tobaccoItemType", ctx),
      startAge: getRiskAnswer(ctx.questionnaireResponses, "tobacco", "startAge", ctx),
      dailyUse: getRiskAnswer(ctx.questionnaireResponses, "tobacco", "consumptionAmount", ctx),
      consumptionUnit: getRiskAnswer(ctx.questionnaireResponses, "tobacco", "consumptionUnit", ctx),
      willingToQuit: getRiskAnswer(ctx.questionnaireResponses, "tobacco", "willingToQuit", ctx),
    },
    alcohol: {
      consumedWithin30Days: getRiskAnswer(ctx.questionnaireResponses, "alcohol", "consumedWithin30Days", ctx),
      drinkOccasion: getRiskAnswer(ctx.questionnaireResponses, "alcohol", "alcoholQ1", ctx),
      drinksPerOccasion: getRiskAnswer(ctx.questionnaireResponses, "alcohol", "alcoholQ2", ctx),
      sixOrMoreDrinks: getRiskAnswer(ctx.questionnaireResponses, "alcohol", "alcoholQ3", ctx)
    },
    fruitsVegetables: {
      eatWeekly: getRiskAnswer(ctx.questionnaireResponses, "fruitsVegetables", "consumptionInWeek", ctx),
      fruitsDays: getRiskAnswer(ctx.questionnaireResponses, "fruitsVegetables", "fruitsDays", ctx),
      fruitServings: getRiskAnswer(ctx.questionnaireResponses, "fruitsVegetables", "fruitServings", ctx),
      vegDays: getRiskAnswer(ctx.questionnaireResponses, "fruitsVegetables", "vegetableDays", ctx),
      vegServings: getRiskAnswer(ctx.questionnaireResponses, "fruitsVegetables", "vegetableServings", ctx)
    },
    physicalActivity: {
      weeklyEngagement: getRiskAnswer(ctx.questionnaireResponses, "physicalActivity", "weeklyEngagement", ctx),
      vigorousDays: getRiskAnswer(ctx.questionnaireResponses, "physicalActivity", "vigorousDays", ctx),
      vigorousTime: getRiskAnswer(ctx.questionnaireResponses, "physicalActivity", "vigorousTime", ctx),
      moderateDays: getRiskAnswer(ctx.questionnaireResponses, "physicalActivity", "moderateDays", ctx),
      moderateTime: getRiskAnswer(ctx.questionnaireResponses, "physicalActivity", "moderateTime", ctx),
    },
    salt: {
      saltAmount: getRiskAnswer(ctx.questionnaireResponses, "salt", "saltAmount", ctx),
      saltAddMeal: getRiskAnswer(ctx.questionnaireResponses, "salt", "saltAddMeal", ctx),
      saltAddCooking: getRiskAnswer(ctx.questionnaireResponses, "salt", "saltAddCooking", ctx),
      processedFood: getRiskAnswer(ctx.questionnaireResponses, "salt", "saltProcessedFood", ctx)
    },
    fats: {
      oilUsed: getRiskAnswer(ctx.questionnaireResponses, "fatAndOil", "oilUsed", ctx),
      fatFoodFrequency: getRiskAnswer(ctx.questionnaireResponses, "fatAndOil", "fatFoodFrequency", ctx),
      otherFat: getRiskAnswer(ctx.questionnaireResponses, "fatAndOil", "otherFatAndOils", ctx)
    },
    sugar: {
      softDrink: getRiskAnswer(ctx.questionnaireResponses, "sugar", "softDrinkFrequency", ctx),
      juice: getRiskAnswer(ctx.questionnaireResponses, "sugar", "juiceFrequency", ctx)
    },
    mealsOutside: {
      eatsOut: getRiskAnswer(ctx.questionnaireResponses, "mealsOutsideHome", "eatsOut", ctx),
      mealsPerWeek: getRiskAnswer(ctx.questionnaireResponses, "mealsOutsideHome", "mealsPerWeek", ctx),
    }
  };
}

function getTobaccoCessation(entries, ctx) {
  const allRefs = [...(ctx.screeningSiteEncounterRefs || []), ...(ctx.facilityEncounterRefs || [])];
  const response = filterByEncounter(ctx.questionnaireResponses, allRefs).find(r => r.item?.some(i => i.linkId === "tobaccoUse"));
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
  const getItem = (id) => response.item?.find(i => i.linkId === id)?.answer?.[0];
  const tobaccoCode = getItem("tobaccoUse")?.valueCoding?.code;
  const tobaccoUseMap = { "1": "Yes, every day", "2": "Yes, sometimes", "3": "No" };
  const assistMap = { "1": "Yes, brief quit plan", "2": "Yes, intensive quit plan", "3": "No", "4": "Refer to intensive counselling" };
  const planStatusMap = { "1": "Active", "2": "Completed", "3": "Abandoned" };
  const pharmaMap = { "1": "Nicotine Replacement Therapy", "2": "Other", "3": "No" };
  const pharmaValue = getItem("pharmacotherapy")?.valueCoding?.code;
  return {
    tobaccoUse: tobaccoUseMap[tobaccoCode] || "--",
    briefAdvice: getItem("briefAdvice")?.valueBoolean === true ? "Yes" : "No",
    assessedStatus: getItem("assessedStatus")?.valueBoolean === true ? "Yes" : "No",
    assistQuit: assistMap[getItem("assistQuit")?.valueCoding?.code] || "--",
    pharmacotherapy: pharmaValue ? (pharmaMap[pharmaValue] || "--") : "--",
    dateOfPlan: getItem("dateOfPlan")?.valueDate ? new Date(getItem("dateOfPlan").valueDate).toLocaleDateString("en-GB") : "--",
    planStatus: planStatusMap[getItem("planStatus")?.valueCoding?.code] || "--"
  };
}

function getDiagnosis(entries, ctx) {
  const filtered = filterByEncounter(ctx.conditions, ctx.encounterRefs);
  const conditions = filtered
    .filter(c => c.category?.some(cat => cat.coding?.some(cd => cd.code === "diagnosis")))
    .sort((a, b) => new Date(b.meta?.lastUpdated) - new Date(a.meta?.lastUpdated));
  if (!conditions.length) return "--";
  const diagnosis = conditions.map(c => c.code?.coding?.[0]?.display).filter(Boolean);
  return diagnosis.length ? diagnosis.join("<br/><br/>") : "--";
}

function resolveMedicationName(m, entries) {
  if (m.medicationCodeableConcept) {
    return m.medicationCodeableConcept?.coding?.[0]?.display || m.medicationCodeableConcept?.text || "Unknown";
  }
  if (m.medicationReference?.reference) {
    const ref = m.medicationReference.reference;
    const med = entries.find(e => e.resource?.resourceType === "Medication" && `Medication/${e.resource.id}` === ref)?.resource;
    if (med) return med.code?.coding?.[0]?.display || med.code?.text || "Unknown";
  }
  return "Unknown";
}

function getMedicationDetails(entries, ctx) {
  const filtered = filterByEncounter(ctx.medicationRequests, ctx.encounterRefs)
    .sort((a, b) => new Date(b.meta?.lastUpdated) - new Date(a.meta?.lastUpdated));
  if (!filtered.length) return [];
  return filtered.map(m => {
    const dosage = m.dosageInstruction?.[0];
    const timing = dosage?.timing?.repeat;
    const dose = dosage?.doseAndRate?.[0]?.doseQuantity;
    return {
      name: resolveMedicationName(m, entries),
      dose: dose ? { value: dose.value, unit: dose.unit || null } : null,
      frequency: timing ? { frequency: timing.frequency || null, period: timing.period || null, unit: timing.periodUnit || null } : null,
      duration: timing?.period ? { value: timing.period, unit: timing.boundsDuration?.unit || "days" } : null,
      instruction: dosage?.additionalInstruction?.[0]?.coding?.[0]?.display || null,
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
    const line1Parts = [];
    if (dose.value) line1Parts.push(`${dose.value} ${dose.unit || ""}`.trim());
    if (frequency.frequency && frequency.period) line1Parts.push(`${frequency.frequency}/${frequency.period}${frequency.unit || ""}`);
    const line1 = line1Parts.join(", ");
    const line2Parts = [];
    if (duration.value) line2Parts.push(`${duration.value} ${duration.unit || ""}`.trim());
    if (med.instruction) line2Parts.push(med.instruction);
    const line2 = line2Parts.join(", ");
    return `<div style="margin-bottom:10px;"><div class="value">${med.name || ""}</div>${line1 ? `<div class="value2">${line1}</div>` : ""}${line2 ? `<div class="value2">${line2}</div>` : ""}${med.status ? `<div class="value3">${med.status}</div>` : ""}</div>`;
  }).join("");
}

function getServiceRequestDetails(entries, ctx) {
  const activityMap = ctx.activityDefinitionMap;
  const filtered = filterByEncounter(entries
    .filter(e => e.resource?.resourceType === "ServiceRequest")
    .map(e => e.resource), ctx.encounterRefs);
  return filtered
    .filter(s =>
      s.category?.some(c =>
        c.coding?.some(cd => cd.code === "10825200" || cd.code === "screening-site-10825200")
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
  return services.map(s => `<div style="margin-bottom:10px;"><div class="value">${s.activities.join("<br/>")}</div><div class="value3">${s.status.charAt(0).toUpperCase() + s.status.slice(1)}</div></div>`).join("");
}

function getHealthFacility(entries, ctx) {
  const idSet = new Set(ctx.allEncounterIds);
  const encounter = ctx.encounters.find(e => e.serviceProvider && idSet.has(String(e.id)));
  if (!encounter?.serviceProvider?.reference) return "--";
  const orgId = encounter.serviceProvider.reference.split("/")[1];
  return ctx.organizationMap[orgId] || "--";
}

function getInterventionDetails(entries, ctx) {
   const activityMap = ctx.activityDefinitionMap;
  const filtered = filterByEncounter(entries
    .filter(e => e.resource?.resourceType === "ServiceRequest")
    .map(e => e.resource), ctx.encounterRefs);
  return filtered
    .filter(s =>
      s.category?.some(c =>
        c.coding?.some(cd => cd.code === "409073007" || cd.code === "screening-site-409073007")
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
  return interventions.map(i => `<div style="margin-bottom:10px;"><div class="value">${i.activities.join("<br/>")}</div><div class="value3">${i.status.charAt(0).toUpperCase() + i.status.slice(1)}</div></div>`).join("");
}

function formatDateDDMMMYYYY(dateStr) {
  if (!dateStr) return "--";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replaceAll(/ /g, "-");
}

function generateFilePassword(name, birthDate) {
  if (!name || !birthDate) return null;
  const cleanName = name.replaceAll(/\s+/g, "").toUpperCase();
  const first4 = cleanName.substring(0, 4);
  const date = new Date(birthDate);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${first4}${dd}${mm}`;
}

function getRiskLevel(value) {
  if (value < 10) return "Low";
  if (value < 20) return "Moderate";
  if (value < 30) return "High";
  return "Very High";
}

function getPartOfId(enc) {
  return enc.partOf?.reference?.split("/")[1];
}

function buildEncounterPartOfMap(encounters) {
  const map = {};
  encounters.forEach(enc => {
    const id = String(enc.id);
    const partOf = getPartOfId(enc);
    if (partOf) {
      if (!map[partOf]) map[partOf] = [];
      map[partOf].push(id);
    }
  });
  return map;
}

function collectConnectedEncounters(targetIds, encounters) {
  const allIds = new Set(targetIds);
  const childrenMap = buildEncounterPartOfMap(encounters);
  const parentsMap = {};
  
  encounters.forEach(enc => {
    const id = String(enc.id);
    const partOf = getPartOfId(enc);
    if (partOf) parentsMap[id] = partOf;
  });

  let changed = true;
  while (changed) {
    changed = false;
    allIds.forEach(tid => {
      (childrenMap[tid] || []).forEach(cid => {
        if (!allIds.has(cid)) { allIds.add(cid); changed = true; }
      });
      const parentId = parentsMap[tid];
      if (parentId && !allIds.has(parentId)) { allIds.add(parentId); changed = true; }
    });
  }
  return allIds;
}

function findPatient(entries) {
  return entries.find(e => e.resource?.resourceType === "Patient")?.resource;
}

function findAppointment(entries, patientId) {
  for (const e of entries) {
    if (e.resource?.resourceType === "Appointment" && e.resource.participant?.some(p => p.actor?.reference === `Patient/${patientId}`)) {
      return e.resource.id;
    }
  }
  return null;
}

function getAppointmentFromEncounter(encounters, encounterSet) {
  for (const enc of encounters) {
    if (enc.appointment?.length && encounterSet.has(String(enc.id))) {
      return enc.appointment[0].reference.split("/")[1];
    }
  }
  return null;
}

function buildObservationFields(ctx, filteredObs) {
  const latestObs = filteredObs
    .sort((a, b) => new Date(b.effectiveDateTime) - new Date(a.effectiveDateTime))[0];
  const riskObs = filteredObs.find(o => o.component?.some(c => c.code?.text === "CVD Risk Percentage"));
  const risk = riskObs?.component?.find(c => c.code?.text === "CVD Risk Percentage")?.valueQuantity;
  return { latestObs, risk };
}

function buildPatientFields(patient) {
  const name = [...(patient?.name?.[0]?.given || []), patient?.name?.[0]?.family || ""].join(" ").trim();
  const heartcareId = patient?.identifier?.find(id => id.system === "https://heartcare.gov.vu/dashboard/patient-info" && id.value)?.value;
  return { name, heartcareId };
}

function buildFileDetails(patient, name, forceType, primaryEncounter) {
  let fileNameParts = [val(patient?.id), forceType];

  if (forceType === "screening-site") {
    const screeningSiteId = getScreeningSiteId(primaryEncounter);

    if (screeningSiteId) {
      fileNameParts.push(screeningSiteId);
    }
  } else if (forceType === "facility") {
    const encounterDate = primaryEncounter.period?.start;
    const formattedDate = formatDateDDMMMYYYY(encounterDate);
    
    fileNameParts.push(formattedDate);
  }

  const fileName = fileNameParts.filter(Boolean).join("-") + ".pdf";

  const filePassword = generateFilePassword(name, patient?.birthDate);

  return { fileName, filePassword };
}

function getScreeningSiteId(primaryEncounter) {
  const locationRef = primaryEncounter?.location?.[0]?.location?.reference;

  if (!locationRef || !locationRef.includes('/')) {
    throw new Error('Invalid or missing location reference in primaryEncounter');
  }

  const screeningSiteId = locationRef.split('/')[1];

  if (!screeningSiteId) {
    throw new Error('screeningSiteId could not be extracted');
  }

  return screeningSiteId;
}

function getPrimaryEncounter(id, encounters) {
  if (!id) {
    throw new Error('Encounter ID is required');
  }

  if (!Array.isArray(encounters)) {
    throw new Error('Encounters must be a valid array');
  }

  const encounter = encounters.find(e => e.id === id);

  if (!encounter) {
    throw new Error(`Primary encounter not found with id: ${id}`);
  }

  return encounter;
}

function buildReport(entries, encounterIds, forceType = null) {
  const patient = findPatient(entries);
  const index = buildEntryIndex(entries);
  let targetIds = (Array.isArray(encounterIds) ? encounterIds : [encounterIds]).map(String);
  
  const encounterIdSet = new Set(index.encounters.map(e => e.id));
  const qrMap = new Map();
  index.questionnaireResponses.forEach(qr => {
    const encRef = qr.encounter?.reference?.split("/")[1];
    if (encRef) qrMap.set(qr.id, encRef);
  });
  
  targetIds = targetIds.map(id => {
    if (encounterIdSet.has(id)) return id;
    return qrMap.get(id) || id;
  }).filter((id, idx, arr) => arr.indexOf(id) === idx);
  
  const allEncounterIds = collectConnectedEncounters(targetIds, index.encounters);
  const allEncounterIdsArr = [...allEncounterIds].sort((a, b) => Number(a) - Number(b));
  const encounterRefs = allEncounterIdsArr.map(id => `Encounter/${id}`);
  
  const screeningSiteRefs = index.screeningSiteEncounterRefs.filter(ref => encounterRefs.includes(ref));
  const facilityRefs = index.facilityEncounterRefs.filter(ref => encounterRefs.includes(ref));
  
  const hasScreeningDirectly = targetIds.some(id => screeningSiteRefs.includes(`Encounter/${id}`));
  const hasFacilityDirectly = targetIds.some(id => facilityRefs.includes(`Encounter/${id}`));
  
  let effectiveRefs = encounterRefs;
  if (forceType === "screening-site" || (hasScreeningDirectly && !hasFacilityDirectly)) {
    effectiveRefs = screeningSiteRefs;
  } else if (forceType === "facility" || (hasFacilityDirectly && !hasScreeningDirectly)) {
    effectiveRefs = facilityRefs;
  }
  
  if (effectiveRefs.length === 0) {
    return {
      report: { name: "--" },
      fileName: "--",
      filePassword: "--",
      appointmentId: null,
      encounterId: null,
      dob: null,
      hasData: false,
      hasScreening: false,
      hasFacility: false
    };
  }
  
  const filteredObs = filterByEncounter(index.observations, effectiveRefs);
  const allEncounterIdsFiltered = effectiveRefs.map(ref => ref.split("/")[1]);
  const ctx = { ...index, encounterRefs: effectiveRefs, allEncounterIds: allEncounterIdsFiltered, screeningSiteEncounterRefs: screeningSiteRefs, facilityEncounterRefs: facilityRefs };
  
  const { latestObs, risk } = buildObservationFields(ctx, filteredObs);
  const { name, heartcareId } = buildPatientFields(patient);
  const riskStatusText = buildRiskStatus(entries, patient, ctx);
  const meds = getMedicationDetails(entries, ctx);
  const services = getServiceRequestDetails(entries, ctx);
  const interventions = getInterventionDetails(entries, ctx);
  
  const report = {
    heartcareId: val(heartcareId),
    name: val(name),
    gender: val(patient?.gender),
    age: calculateAge(patient?.birthDate),
    visitDate: latestObs?.effectiveDateTime ? new Date(latestObs.effectiveDateTime).toLocaleDateString("en-GB") : "--",
    riskPrediction: risk ? `${risk.value}% ${getRiskLevel(risk.value)}` : "--",
    riskStatus: riskStatusText,
    weight: formatWeight(entries, ctx),
    height: formatHeight(entries, ctx),
    bp: getBloodPressure(entries, ctx),
    cholesterol: formatCholesterol(entries, ctx),
    bmi: formatBMI(getObservationByCode(ctx.observations, "9156-5", effectiveRefs)[0]?.value),
    chiefComplaint: getChiefComplaintById(index.encounters, allEncounterIdsFiltered)?.reasonCode?.[0]?.text || "--",
    glucose: getGlucose(entries, ctx),
    abdominal: getVital(entries, "Abdominal circumference", ctx),
    creatinine: getVital(entries, "Serum creatinine", ctx),
    foot: getVital(entries, "Foot examination", ctx),
    hip: getVital(entries, "Hip circumference", ctx),
    potassium: getVital(entries, "Serum potassium", ctx),
    eye: getVital(entries, "Eye examination", ctx),
    hba1c: getVital(entries, "HbA1c", ctx),
    urineKetone: getVital(entries, "Urine ketones", ctx),
    priorDiagnosis: getPriorDiagnosis(entries, ctx),
    familyHistory: getFamilyHistory(entries, ctx),
    adherence: getAdherence(entries, ctx),
    sideEffects: getSideEffects(entries, ctx),
    allergies: getAllergies(entries, ctx),
    prescribedMedication: getPrescribedMedication(entries, ctx),
    riskFactors: getRiskFactors(entries, ctx),
    tobaccoCessation: getTobaccoCessation(entries, ctx),
    notes: meds.map(m => m.note).filter(Boolean).join("<br/><br/>") || "--",
    diagnosis: getDiagnosis(entries, ctx),
    medication: buildMedicationHTML(meds),
    examination: buildServiceRequestHTML(services),
    intervention: buildInterventionHTML(interventions),
    facility: getHealthFacility(entries, ctx),
    reportType: forceType || (effectiveRefs === screeningSiteRefs ? "screening-site" : "facility")
  };
  
  report.guidance = buildWHOGuidance(report);
  report.personalSummary = buildPersonalSummary(report);

  const primaryEncounterId = allEncounterIdsFiltered[0];
  let primaryEncounter = null;
  if (primaryEncounterId) {
    try {
      primaryEncounter = getPrimaryEncounter(primaryEncounterId, index.encounters);
    } catch (e) {
      console.warn("Primary encounter not found:", primaryEncounterId, e.message);
    }
  }
  
  const { fileName, filePassword } = buildFileDetails(patient, name, forceType, primaryEncounter);
  
  let appointmentId = getAppointmentFromEncounter(index.encounters, allEncounterIds) || findAppointment(entries, patient?.id);
  
return {
    report,
    fileName,
    filePassword,
    appointmentId,
    encounterId: allEncounterIdsFiltered[0],
    dob: patient?.birthDate,
    hasData: effectiveRefs.length > 0,
    hasScreening: screeningSiteRefs.length > 0,
    hasFacility: facilityRefs.length > 0
  };
}

module.exports = { buildReport };