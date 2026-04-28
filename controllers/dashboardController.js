const {
    fetchResource,
    handleError,
    fetchMainResourcesParallel,
    fetchInBatches
} = require("../services/helperFunctions");
const { enrichCvdRisk } = require("../services/cvdRiskService");
const { calculateClassifications } = require("../utils/classificationUtil");

const CAMPAIGN_CVD_ENCOUNTER_CODE = "screening-site-cvd-encounter";
const LOCATION_BATCH_SIZE = 50;
const PATIENT_BATCH_SIZE = 50;
const OBS_BATCH_SIZE = 20;

async function fetchPatientsById(patientIds, token) {
    const map = new Map();
    if (!patientIds.length) return map;

    const batchResults = await fetchInBatches(
        patientIds,
        PATIENT_BATCH_SIZE,
        (batch) => fetchResource("Patient", { _id: batch.join(","), _count: batch.length }, token)
    );

    for (const res of batchResults) {
        for (const entry of res.entry || []) {
            const r = entry.resource;

            let age = null;
            if (r.birthDate) {
                const birth = new Date(r.birthDate);
                const today = new Date();
                age = today.getFullYear() - birth.getFullYear();
                if (
                    today.getMonth() < birth.getMonth() ||
                    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
                ) age--;
            }

            const nameObj = r.name?.[0];
            const name = nameObj
                ? nameObj.text || `${(nameObj.given || []).join(" ")} ${nameObj.family || ""}`.trim()
                : null;

            const address = r.address?.[0];

            map.set(r.id, {
                patientId: r.id,
                patientName: name,
                age,
                gender: r.gender || null,
                village: address?.line?.join(" ") || null,
                _cityId: address?.city || null,
                _districtId: address?.district || null,
                _stateId: address?.state || null,
            });
        }
    }

    return map;
}

async function fetchLocationsById(locationIds, token) {
    const map = new Map();
    const unique = [...new Set(locationIds)].filter(Boolean);
    if (!unique.length) return map;

    const batchResults = await fetchInBatches(
        unique,
        LOCATION_BATCH_SIZE,
        (batch) => fetchResource("Location", { _id: batch.join(","), _count: batch.length }, token)
    );

    for (const res of batchResults) {
        for (const entry of res.entry || []) {
            map.set(entry.resource.id, entry.resource);
        }
    }

    return map;
}

async function fetchObservationsByEncounter(encounterIds, token) {
    const map = new Map();
    if (!encounterIds.length) return map;
    const observationBundle = await fetchMainResourcesParallel(
        "Observation",
        {
            encounter: encounterIds.join(","),
            _count: 1000
        },
        token
    );

    for (const entry of observationBundle.entry || []) {
        const resource = entry.resource;
        const encId = resource.encounter?.reference?.split("/")[1];
        if (!encId) continue;

        if (!map.has(encId)) map.set(encId, {});
        const obs = map.get(encId);

        const code = resource.code?.text;
        const getVal = (label) =>
            resource.component?.find(c => c.code?.text === label)?.valueQuantity?.value ?? null;

        // Debug: log CVD risk related observations
        if (code?.toLowerCase().includes("risk") || code?.toLowerCase().includes("cvd")) {
            console.log("CVD Risk Observation:", JSON.stringify({
                code,
                valueQuantity: resource.valueQuantity,
                component: resource.component?.map(c => ({
                    code: c.code?.text,
                    value: c.valueQuantity?.value
                }))
            }, null, 2));
        }

        switch (code) {
            case "Blood Pressure":
                obs.bpSystolic = getVal("Systolic blood pressure");
                obs.bpDiastolic = getVal("Diastolic blood pressure");
                break;
            case "BMI": obs.bmi = getVal("BMI"); break;
            case "Diabetic status": obs.glucose = getVal("Diabetic status"); break;
            case "Cholesterol": obs.cholesterol = getVal("Cholesterol"); break;
            case "Smoking Status": obs.smoker = getVal("Smoking Status"); break;
        }
    }

    return map;
}
function getScreeningDate(encounter) {
    return encounter.extension
        ?.find(e => e.url?.includes("screening-date"))
        ?.valueDateTime?.split("T")[0] || null;
}

function getScreeningSite(encounter, locationMap) {
    for (const locEntry of encounter.location || []) {
        const id = locEntry.location?.reference?.split("/")[1];
        const resource = locationMap.get(id);
        if (!resource) continue;

        const isScreeningSite = resource.type?.some(t =>
            t.coding?.some(c => c.code === "SCREENING_SITE")
        );

        if (isScreeningSite) {
            return { screeningSite: resource.name, screeningSiteId: resource.id };
        }
    }
    return { screeningSite: null, screeningSiteId: null };
}

const getScreeningSiteDashboard = async (req, res) => {
    try {
        const token = req.accessToken;
        const screeningSiteIds = req.query.screeningSiteIds
        // ── 1. Fetch ALL encounter pages in parallel ───────────────────────────
        const encounterBundle = await fetchMainResourcesParallel(
            "Encounter",
            { type: CAMPAIGN_CVD_ENCOUNTER_CODE, location: screeningSiteIds, _sort: "-date" },
            token
        );

        const encounters = encounterBundle.entry?.map(e => e.resource) || [];
        if (!encounters.length) return res.json({ status: 1, data: [], total: 0 });

        // ── 2. Collect all IDs in one pass ────────────────────────────────────
        const patientIds = new Set();
        const locationIds = new Set();
        const encounterIds = encounters.map(e => e.id);

        for (const enc of encounters) {
            const pid = enc.subject?.reference?.split("/")[1];
            if (pid) patientIds.add(pid);

            for (const loc of enc.location || []) {
                const lid = loc.location?.reference?.split("/")[1];
                if (lid) locationIds.add(lid);
            }
        }

        // ── 3. Fetch patients + encounter locations + observations in parallel ─
        const [patientMap, locationMap, obsMap] = await Promise.all([
            fetchPatientsById([...patientIds], token),
            fetchLocationsById([...locationIds], token),
            fetchObservationsByEncounter(encounterIds, token),
        ]);

        // ── 4. Fetch any patient address locations missing from locationMap ────
        const missingIds = new Set();
        for (const [, p] of patientMap) {
            if (p._cityId && !locationMap.has(p._cityId)) missingIds.add(p._cityId);
            if (p._districtId && !locationMap.has(p._districtId)) missingIds.add(p._districtId);
            if (p._stateId && !locationMap.has(p._stateId)) missingIds.add(p._stateId);
        }

        if (missingIds.size) {
            const extra = await fetchLocationsById([...missingIds], token);
            extra.forEach((v, k) => locationMap.set(k, v));
        }

        // ── 5. Assemble records — pure synchronous Map lookups ────────────────
        const dedupMap = new Map();

        for (const enc of encounters) {
            const patientId = enc.subject?.reference?.split("/")[1];
            if (!patientId) continue;

            const patient = patientMap.get(patientId);
            if (!patient) continue;

            const screeningDate = getScreeningDate(enc);

            const existing = dedupMap.get(patientId);
            if (existing && new Date(screeningDate) <= new Date(existing.screeningDate)) continue;

            const obs = obsMap.get(enc.id) || {};
            const location = getScreeningSite(enc, locationMap);

            const record = {
                patientId: patient.patientId,
                patientName: patient.patientName,
                age: patient.age,
                gender: patient.gender,
                village: patient.village,
                province: locationMap.get(patient._stateId)?.name || patient._stateId || null,
                island: locationMap.get(patient._districtId)?.name || patient._districtId || null,
                areaCouncil: locationMap.get(patient._cityId)?.name || patient._cityId || null,
                ...location,
                bmi: obs.bmi ?? null,
                sysBP: obs.bpSystolic ?? null,
                diaBP: obs.bpDiastolic ?? null,
                glucose: obs.glucose ?? null,
                cholesterol: obs.cholesterol ?? null,
                smoker: obs.smoker ?? 0,
                cvdRisk: obs.cvdRisk ?? null,
                screeningDate,
            };
            enrichCvdRisk(record);
            Object.assign(record, calculateClassifications(record));
            dedupMap.set(patientId, record);
        }

        return res.json({
            status: 1,
            data: Array.from(dedupMap.values()),
            total: dedupMap.size,
        });

    } catch (error) {
        console.error("Dashboard Error:", error);
        return handleError(res, error);
    }
};

module.exports = { getScreeningSiteDashboard };