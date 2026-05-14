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
    BP: "Blood Pressure", BMI: "BMI", GLUCOSE: "Blood glucose",
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
        village: patientResource.address?.[0]?.line?.[0] || null,
        _villageId: patientResource.address?.[0]?.line?.[0] || null,
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
    if (resource.valueQuantity?.value !== undefined) {
        return {
            value: resource.valueQuantity.value,
            unit: resource.valueQuantity.unit || null
        };
    }
    if (resource.valueString) {
        return { value: resource.valueString, unit: null };
    }
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
        village: locationMap.get(patient._villageId)?.name || patient._villageId || null,
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

async function fetchObservationsByPatient(patientIds, token) {
    if (!patientIds.length) return new Map();
    const map = new Map();
    const batchResults = await fetchInBatches(patientIds, 10, async(batch) => {
        const firstPage = await fetchResource("Observation", { patient: batch.join(","), _count: 500, _total: "accurate" }, token);
        const total = firstPage.total || 0;
        const firstEntries = firstPage.entry || [];
        const firstLinks = firstPage.link || [];
        if (!firstLinks.some(l => l.relation === "next")) {
            return { entry: firstEntries, total };
        }
        const pageCount = Math.ceil(total / 500);
        const pages = [firstPage];
        for (let p = 2; p <= pageCount; p++) {
            const next = await fetchResource("Observation", { patient: batch.join(","), _count: 500, _page: p, _total: "accurate" }, token);
            pages.push(next);
        }
        return { entry: pages.flatMap(p => p.entry || []), total };
    });
    for (const res of batchResults) {
        for (const entry of res.entry || []) {
            const r = entry.resource;
            const patId = getIdFromRef(r.subject);
            if (!patId) continue;
            if (!map.has(patId)) map.set(patId, {});
            const obs = map.get(patId);
            const obsDate = r.effectiveDateTime || r.meta?.lastUpdated || null;

            if (r.code?.coding?.[0]?.code === "36048009") {
                const comp = r.component?.find(c => c.code?.coding?.[0]?.code === "36048009")?.valueQuantity;
                const val = comp?.value ?? r.valueQuantity?.value ?? null;
                if (!obs.glucose || (obsDate && obsDate > (obs._glucoseDate || ""))) {
                    obs.glucose = val;
                    obs.glucoseUnit = comp?.unit ?? null;
                    obs.glucoseType = r.code?.coding?.[0]?.display || null;
                    obs._glucoseDate = obsDate;
                }
                continue;
            }
            const codeText = r.code?.text?.toLowerCase() || "";
            const code = r.code?.text || "";
            const firstCod = r.code?.coding?.[0]?.display?.toLowerCase() || "";

            if (codeText === "blood pressure" || firstCod === "blood pressure") {
                const systolic = r.component?.find(c => (c.code?.text || "").toLowerCase().includes("systolic"))?.valueQuantity?.value ?? null;
                const diastolic = r.component?.find(c => (c.code?.text || "").toLowerCase().includes("diastolic"))?.valueQuantity?.value ?? null;
                if (!obs.bpSystolic || (obsDate && obsDate > (obs._bpDate || ""))) {
                    obs.bpSystolic = systolic; obs.bpDiastolic = diastolic; obs._bpDate = obsDate;
                }
            } else if (codeText === "bmi" || firstCod === "body mass index (bmi) [ratio]") {
                const bmiComp = r.component?.find(c => (c.code?.text || "").toLowerCase() === "bmi");
                const bmi = bmiComp?.valueQuantity?.value ?? r.valueQuantity?.value ?? null;
                if (!obs.bmi || (obsDate && obsDate > (obs._bmiDate || ""))) {
                    obs.bmi = bmi; obs._bmiDate = obsDate;
                }
            } else if (codeText === "cholesterol" || firstCod.includes("cholesterol")) {
                const cholComp = r.component?.find(c => (c.code?.text || "").toLowerCase() === "cholesterol");
                const cVal = cholComp?.valueQuantity?.value ?? r.valueQuantity?.value ?? null;
                const cUnit = cholComp?.valueQuantity?.unit ?? r.valueQuantity?.unit ?? "mmol/L";
                if (!obs.cholesterol || (obsDate && obsDate > (obs._cholDate || ""))) {
                    obs.cholesterol = cVal; obs.cholesterolUnit = cUnit; obs._cholDate = obsDate;
                }
            } else if (codeText === "smoking status" || firstCod.includes("smoking") || firstCod === "smoking status") {
                const smokeVal = r.component?.[0]?.valueQuantity?.value ?? r.valueQuantity?.value ?? null;
                const smokeStr = r.valueString || r.valueCodeableConcept?.text || null;
                let smokerVal = null;
                if (smokeVal !== null) smokerVal = smokeVal >= 1 ? 1 : 0;
                else if (smokeStr) smokerVal = (smokeStr.toLowerCase().includes("yes") || smokeStr.toLowerCase().includes("smoking") || smokeStr.toLowerCase().includes("current")) ? 1 : 0;
                if (smokerVal !== null && (!obs.smoker || (obsDate && obsDate > (obs._smokeDate || "")))) {
                    obs.smoker = smokerVal; obs._smokeDate = obsDate;
                }
            } else if (codeText === "cvd risk percentage" || codeText === "cvd risk" || firstCod.includes("cardiovascular disease risk")) {
                const riskComp = r.component?.find(c => (c.code?.text || "").toLowerCase().includes("cvd risk"));
                const risk = riskComp?.valueQuantity?.value ?? r.valueQuantity?.value ?? null;
                if (!obs.cvdRisk || (obsDate && obsDate > (obs._riskDate || ""))) {
                    obs.cvdRisk = risk; obs._riskDate = obsDate;
                }
            }
        }
    }
    for (const [, obs] of map) {
        delete obs._glucoseDate; delete obs._bpDate; delete obs._bmiDate; delete obs._cholDate; delete obs._smokeDate; delete obs._riskDate;
    }
    return map;
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

function collectPatientLocationIds(patientMap) {
    const locationIds = new Set();
    for (const [, p] of patientMap) {
        if (p._villageId) locationIds.add(p._villageId);
        if (p._cityId) locationIds.add(p._cityId);
        if (p._districtId) locationIds.add(p._districtId);
        if (p._stateId) locationIds.add(p._stateId);
    }
    return locationIds;
}

async function fetchPatientAddressLocations(patientMap, token) {
    const patientLocationIds = collectPatientLocationIds(patientMap);
    if (!patientLocationIds.size) return new Map();
    return fetchLocationsById([...patientLocationIds], token);
}

function enrichPatientLocations(patientMap, locationMap) {
    for (const [, p] of patientMap) {
        if (p._villageId && !locationMap.has(p._villageId)) locationMap.set(p._villageId, { id: p._villageId, name: p._villageId });
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

        const obs = obsMap.get(patientId) || {};
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
        console.log("Total patients:", patientIds.size, "locations:", locationIds.size);

        const [patientMap, locationMap, obsMap] = await Promise.all([
            fetchPatientsById([...patientIds], token),
            fetchLocationsById([...locationIds], token),
            fetchObservationsByPatient([...patientIds], token)
        ]);

        console.log("Patient map size:", patientMap.size, "Obs map size:", obsMap.size);
        const patientAddressLocationMap = await fetchPatientAddressLocations(patientMap, token);
        for (const [id, loc] of patientAddressLocationMap) {
            locationMap.set(id, loc);
        }

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