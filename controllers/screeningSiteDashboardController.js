const {
    fetchResource,
    handleError,
    fetchMainResourcesParallel,
    fetchInBatches
} = require("../services/helperFunctions");

const ENCOUNTER_CODES = Object.freeze({
    SCREENING: "screening-site-cvd-encounter",
    FACILITY: "facility-cvd-encounter"
});
const BATCH_SIZES = Object.freeze({ LOCATION: 50, PATIENT: 50 });
const OBS_CODES = Object.freeze({
    BP: "Blood Pressure", BMI: "BMI", GLUCOSE: "Diabetic status",
    CHOLESTEROL: "Cholesterol", SMOKING: "Smoking Status", RISK: "CVD Risk Percentage"
});

function getIdFromRef(ref) {
    return ref?.reference?.split("/")[1];
}

function calculateAge(birthDate) {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    if (today.getMonth() < birth.getMonth() ||
        (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
}

function buildPatientName(nameObj) {
    if (!nameObj) return null;
    return nameObj.text || `${(nameObj.given || []).join(" ")} ${nameObj.family || ""}`.trim();
}

function parsePatient(patientResource) {
    return {
        patientId: patientResource.id,
        patientName: buildPatientName(patientResource.name?.[0]),
        age: calculateAge(patientResource.birthDate),
        gender: patientResource.gender || null,
        village: patientResource.address?.[0]?.line?.join(" ") || null,
        _cityId: patientResource.address?.[0]?.city || null,
        _districtId: patientResource.address?.[0]?.district || null,
        _stateId: patientResource.address?.[0]?.state || null,
    };
}

async function fetchPatientsById(patientIds, token) {
    if (!patientIds.length) return new Map();
    const map = new Map();
    const batchResults = await fetchInBatches(
        patientIds, BATCH_SIZES.PATIENT,
        (batch) => fetchResource("Patient", { _id: batch.join(","), _count: batch.length }, token)
    );
    for (const res of batchResults) {
        for (const entry of res.entry || []) {
            map.set(entry.resource.id, parsePatient(entry.resource));
        }
    }
    return map;
}

function parseLocation(resource) {
    return { id: resource.id, name: resource.name, type: resource.type };
}

async function fetchLocationsById(locationIds, token) {
    if (!locationIds.length) return new Map();
    const unique = [...new Set(locationIds)].filter(Boolean);
    const map = new Map();
    const batchResults = await fetchInBatches(
        unique, BATCH_SIZES.LOCATION,
        (batch) => fetchResource("Location", { _id: batch.join(",") }, token)
    );
    for (const res of batchResults) {
        for (const entry of res.entry || []) {
            const loc = parseLocation(entry.resource);
            map.set(loc.id, loc);
        }
    }
    return map;
}

function getObsValue(resource, label) {
    return resource.component?.find(c => c.code?.text === label)?.valueQuantity?.value ?? null;
}

function getObsValueWithUnit(resource, label) {
    const comp = resource.component?.find(c => c.code?.text === label);
    return {
        value: comp?.valueQuantity?.value ?? comp?.value ?? null,
        unit: comp?.valueQuantity?.unit ?? null
    };
}

function getCvdRiskValue(resource) {
    const component = resource.component?.find(c => c.code?.text === "CVD Risk Percentage");
    return resource.valueQuantity?.value ?? component?.valueQuantity?.value ?? component?.value ?? null;
}

async function fetchObservationsByEncounter(encounterIds, token) {
    if (!encounterIds.length) return new Map();
    const map = new Map();
    const bundle = await fetchMainResourcesParallel(
        "Observation",
        { encounter: encounterIds.join(","), _count: 1000, _total: "accurate" },
        token
    );

    for (const entry of bundle.entry || []) {
        const r = entry.resource;
        const encId = getIdFromRef(r.encounter);
        if (!encId) continue;

        if (!map.has(encId)) map.set(encId, {});
        const obs = map.get(encId);
        const code = r.code?.text;

        switch (code) {
            case OBS_CODES.BP:
                obs.bpSystolic = getObsValue(r, "Systolic blood pressure");
                obs.bpDiastolic = getObsValue(r, "Diastolic blood pressure");
                break;
            case OBS_CODES.BMI:
                obs.bmi = getObsValue(r, "BMI");
                break;
            case OBS_CODES.GLUCOSE: {
                const g = getObsValueWithUnit(r, "Diabetic status");
                obs.glucose = g.value; obs.glucoseUnit = g.unit; obs.glucoseType = "random";
                break;
            }
            case OBS_CODES.CHOLESTEROL: {
                const c = getObsValueWithUnit(r, "Cholesterol");
                obs.cholesterol = c.value; obs.cholesterolUnit = c.unit ?? "mmol/L";
                break;
            }
            case OBS_CODES.SMOKING:
                obs.smoker = getObsValue(r, "Smoking Status");
                break;
            case OBS_CODES.RISK:
            case "CVD Risk":
            case "Cardiovascular disease risk score":
                obs.cvdRisk = getCvdRiskValue(r);
                break;
        }
    }
    return map;
}

function getExtensionValue(encounter, urlPart) {
    return encounter.extension?.find(e => e.url?.includes(urlPart))?.valueDateTime || null;
}

function findLocationByType(encounter, locationMap, typeCode) {
    for (const locEntry of encounter.location || []) {
        const id = getIdFromRef(locEntry.location);
        const resource = locationMap.get(id);
        if (!resource) continue;
        const isMatch = resource.type?.some(t => t.coding?.some(c => c.code === typeCode));
        if (isMatch) return resource;
    }
    return null;
}

function buildRecord(patient, obs, locationMap, encounter, facilityName) {
    return {
        patientId: patient.patientId,
        patientName: patient.patientName,
        age: patient.age,
        gender: patient.gender,
        village: patient.village,
        province: locationMap.get(patient._stateId)?.name || patient._stateId || null,
        island: locationMap.get(patient._districtId)?.name || patient._districtId || null,
        areaCouncil: locationMap.get(patient._cityId)?.name || patient._cityId || null,
        bmi: obs.bmi ?? null,
        sysBP: obs.bpSystolic == null ? null : String(obs.bpSystolic),
        diaBP: obs.bpDiastolic == null ? null : String(obs.bpDiastolic),
        glucose: obs.glucose ?? null,
        glucoseType: obs.glucoseType ?? null,
        glucoseUnit: obs.glucoseUnit ?? null,
        cholesterol: obs.cholesterol ?? null,
        cholesterolUnit: obs.cholesterolUnit ?? null,
        smoker: obs.smoker ?? 0,
        cvdRisk: obs.cvdRisk ?? null,
        healthFacility: facilityName,
        screeningSite: findLocationByType(encounter, locationMap, "SCREENING_SITE")?.name || null,
        screeningDate: getExtensionValue(encounter, "screening-date"),
    };
}

async function fetchAllEncounters(token, screeningSiteIds) {
    const [screening, facility] = await Promise.all([
        fetchMainResourcesParallel("Encounter", { type: ENCOUNTER_CODES.SCREENING, location: screeningSiteIds, _sort: "-date", _count: 1000, _total: "accurate" }, token),
        fetchMainResourcesParallel("Encounter", { type: ENCOUNTER_CODES.FACILITY, _sort: "-date", _count: 1000, _total: "accurate" }, token)
    ]);
    return {
        screening: (screening.entry || []).map(e => e.resource),
        facility: (facility.entry || []).map(e => e.resource)
    };
}

function collectIds(encounters) {
    const patientIds = new Set();
    const locationIds = new Set();
    for (const enc of encounters) {
        const pid = getIdFromRef(enc.subject);
        if (pid) patientIds.add(pid);
        for (const loc of enc.location || []) {
            const lid = getIdFromRef(loc.location);
            if (lid) locationIds.add(lid);
        }
    }
    return { patientIds, locationIds };
}

function enrichPatientLocations(patientMap, locationMap) {
    for (const [, p] of patientMap) {
        if (p._cityId && !locationMap.has(p._cityId)) locationMap.set(p._cityId, { id: p._cityId, name: p._cityId });
        if (p._districtId && !locationMap.has(p._districtId)) locationMap.set(p._districtId, { id: p._districtId, name: p._districtId });
        if (p._stateId && !locationMap.has(p._stateId)) locationMap.set(p._stateId, { id: p._stateId, name: p._stateId });
    }
}

function buildFacilityMap(facilityEncounters, locationMap) {
    const map = new Map();
    for (const enc of facilityEncounters) {
        const patientId = getIdFromRef(enc.subject);
        if (!patientId) continue;
        const facility = findLocationByType(enc, locationMap, "FACILITY");
        if (facility) map.set(patientId, facility.name);
    }
    return map;
}

function processScreeningEncounters(screeningEncounters, patientMap, obsMap, locationMap, facilityMap) {
    const records = [];
    for (const enc of screeningEncounters) {
        const patientId = getIdFromRef(enc.subject);
        if (!patientId) continue;
        const patient = patientMap.get(patientId);
        if (!patient) continue;

        const obs = obsMap.get(enc.id) || {};
        const facility = facilityMap.get(patientId);
        const record = buildRecord(patient, obs, locationMap, enc, facility);
        records.push(record);
    }
    return records;
}

async function getScreeningSiteDashboard(req, res) {
    try {
        const token = req.accessToken;
        const screeningSiteIds = req.query.screeningSiteIds;

        const { screening: screeningEncounters, facility: facilityEncounters } = await fetchAllEncounters(token, screeningSiteIds);
        const allEncounters = [...screeningEncounters, ...facilityEncounters];
        if (!allEncounters.length) return res.json({ status: 1, data: [], total: 0 });

        const { patientIds, locationIds } = collectIds(allEncounters);
        
        const [patientMap, locationMap, obsMap] = await Promise.all([
            fetchPatientsById([...patientIds], token),
            fetchLocationsById([...locationIds], token),
            fetchObservationsByEncounter(allEncounters.map(e => e.id), token)
        ]);

        enrichPatientLocations(patientMap, locationMap);
        const facilityMap = buildFacilityMap(facilityEncounters, locationMap);
        const dedupMap = processScreeningEncounters(screeningEncounters, patientMap, obsMap, locationMap, facilityMap);

        return res.json({ status: 1, data: dedupMap, total: dedupMap.length });
    } catch (error) {
        console.error("Dashboard Error:", error);
        return handleError(res, error);
    }
}

module.exports = { getScreeningSiteDashboard };