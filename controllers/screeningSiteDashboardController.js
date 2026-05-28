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
        (batch) => fetchResource("Location", { _id: batch.join(","), _count: batch.length }, token)
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
    if (!encounter.extension) return null;

    for (const ext of encounter.extension) {

        // direct match
        if (ext.url?.includes(urlPart)) {
            return ext.valueDateTime || ext.valueDate || ext.valueInstant || ext.valueString || null;
        }

        // 🔥 nested extension support
        if (ext.extension) {
            const nested = ext.extension.find(e => e.url?.includes(urlPart));
            if (nested) {
                return nested.valueDateTime || nested.valueDate || nested.valueInstant || nested.valueString || null;
            }
        }
    }

    return null;
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
        smoker: obs.smoker ?? null,
        cvdRisk: obs.cvdRisk ?? null,
        healthFacility: facilityName,
        screeningSite: findLocationByType(encounter, locationMap, "SCREENING_SITE")?.name || null,
    };
}

async function fetchAllEncounters(token, screeningSiteIds) {
    const [screeningMain, screeningCvd, facility] = await Promise.all([
        fetchMainResourcesParallel("Encounter", {
            type: "screening-site-main-encounter",
            location: screeningSiteIds,
            _count: 1000
        }, token),

        fetchMainResourcesParallel("Encounter", {
            type: "screening-site-cvd-encounter",
            location: screeningSiteIds,
            _count: 1000
        }, token),

        fetchMainResourcesParallel("Encounter", {
            type: "facility-main-encounter",
            _count: 1000
        }, token)
    ]);

    return {
        screeningMain: (screeningMain.entry || []).map(e => e.resource),
        screeningCvd: (screeningCvd.entry || []).map(e => e.resource),
        facility: (facility.entry || []).map(e => e.resource)
    };
}
function mapCvdToMain(screeningCvdEncounters) {
    const map = new Map();

    for (const enc of screeningCvdEncounters) {
        const mainId = enc.partOf?.reference?.split("/")[1];

        if (mainId) {
            map.set(mainId, enc);
        }
    }

    return map;
}

async function fetchObservationsByPatient(patientIds, token) {
    if (!patientIds.length) return new Map();
    const map = new Map();
    const batchResults = await fetchInBatches(patientIds, 10, async (batch) => {
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

async function fetchGlucoseByPatient(patientIds, token) {
    const map = new Map();

    const batchResults = await fetchInBatches(patientIds, 10, (batch) =>
        fetchResource("Observation", {
            subject: batch.join(","),
            _count: 500
        }, token)
    );

    for (const res of batchResults) {
        for (const entry of res.entry || []) {
            const r = entry.resource;

            const patId = getIdFromRef(r.subject);
            if (!patId) continue;

            // 🔥 Only glucose
            if (r.code?.coding?.[0]?.code !== "36048009") continue;

            if (!map.has(patId)) map.set(patId, {});
            const obs = map.get(patId);

            const obsDate = r.effectiveDateTime || r.meta?.lastUpdated || null;

            const comp = r.component?.find(c =>
                c.code?.coding?.[0]?.code === "36048009"
            )?.valueQuantity;

            const val = comp?.value ?? r.valueQuantity?.value ?? null;

            if (!obs.glucose || (obsDate && obsDate > (obs._glucoseDate || ""))) {
                obs.glucose = val;
                obs.glucoseUnit = comp?.unit ?? null;
                obs.glucoseType = r.code?.coding?.[0]?.display || null;
                obs._glucoseDate = obsDate;
            }
        }
    }

    for (const [, obs] of map) {
        delete obs._glucoseDate;
    }

    return map;
}

async function fetchObservationsByEncounter(encounterIds, token) {
    const map = new Map();

    const batchResults = await fetchInBatches(encounterIds, 20, (batch) =>
        fetchResource("Observation", {
            encounter: batch.join(","),
            _count: 500
        }, token)
    );

    for (const res of batchResults) {
        for (const entry of res.entry || []) {
            const r = entry.resource;
            const encId = getIdFromRef(r.encounter);
            if (!encId) continue;

            if (!map.has(encId)) map.set(encId, {});
            const obs = map.get(encId);

            const obsDate = r.effectiveDateTime || r.meta?.lastUpdated || null;

            const codeText = r.code?.text?.toLowerCase() || "";
            const firstCod = r.code?.coding?.[0]?.display?.toLowerCase() || "";

            // BP
            if (codeText === "blood pressure" || firstCod === "blood pressure") {
                const systolic = r.component?.find(c => (c.code?.text || "").toLowerCase().includes("systolic"))?.valueQuantity?.value ?? null;
                const diastolic = r.component?.find(c => (c.code?.text || "").toLowerCase().includes("diastolic"))?.valueQuantity?.value ?? null;

                if (!obs.bpSystolic || obsDate > (obs._bpDate || "")) {
                    obs.bpSystolic = systolic;
                    obs.bpDiastolic = diastolic;
                    obs._bpDate = obsDate;
                }
            }

            // BMI
            else if (codeText === "bmi" || firstCod.includes("bmi")) {
                const bmi = r.component?.[0]?.valueQuantity?.value ?? r.valueQuantity?.value ?? null;

                if (!obs.bmi || obsDate > (obs._bmiDate || "")) {
                    obs.bmi = bmi;
                    obs._bmiDate = obsDate;
                }
            }

            // Cholesterol
            else if (codeText === "cholesterol" || firstCod.includes("cholesterol")) {
                const val = r.component?.[0]?.valueQuantity?.value ?? r.valueQuantity?.value ?? null;

                if (!obs.cholesterol || obsDate > (obs._cholDate || "")) {
                    obs.cholesterol = val;
                    obs._cholDate = obsDate;
                }
            }

            // Smoking
            else if (codeText === "smoking status" || firstCod.includes("smoking")) {
                const val = r.component?.[0]?.valueQuantity?.value ?? r.valueQuantity?.value ?? null;

                if (val !== null && (!obs.smoker || obsDate > (obs._smokeDate || ""))) {
                    obs.smoker = val >= 1 ? 1 : 0;
                    obs._smokeDate = obsDate;
                }
            }

            // CVD Risk
            else if (codeText.includes("cvd risk") || firstCod.includes("cardiovascular")) {
                const val = r.component?.[0]?.valueQuantity?.value ?? r.valueQuantity?.value ?? null;

                if (!obs.cvdRisk || obsDate > (obs._riskDate || "")) {
                    obs.cvdRisk = val;
                    obs._riskDate = obsDate;
                }
            }
        }
    }

    // cleanup
    for (const [, obs] of map) {
        delete obs._bpDate;
        delete obs._bmiDate;
        delete obs._cholDate;
        delete obs._smokeDate;
        delete obs._riskDate;
    }

    return map;
}
function buildScreeningDateMap(screeningCvdEncounters) {
    const map = new Map();

    for (const enc of screeningCvdEncounters) {
        const mainId = enc.partOf?.reference?.split("/")[1];
        if (!mainId) continue;

        const date = getExtensionValue(enc, "screening-date");

        if (date) {
            map.set(mainId, date);
        }
    }

    return map;
}
async function getScreeningSiteDashboard(req, res) {
    try {
        const token = req.accessToken;
        const screeningSiteIds = req.query.screeningSiteIds;

        const {
            screeningMain,
            screeningCvd,
            facility
        } = await fetchAllEncounters(token, screeningSiteIds);
        const screeningDateMap = buildScreeningDateMap(screeningCvd);
        if (!screeningMain.length) {
            return res.json({ status: 1, data: [], total: 0 });
        }

        // 🔥 Map CVD → MAIN
        const cvdToMainMap = mapCvdToMain(screeningCvd);

        // Collect IDs
        const allEncounters = [...screeningMain, ...facility];
        const { patientIds, locationIds } = collectIds(allEncounters);

        const [patientMap, locationMap] = await Promise.all([
            fetchPatientsById([...patientIds], token),
            fetchLocationsById([...locationIds], token)
        ]);

        // Add patient address locations
        const patientAddressLocationMap = await fetchPatientAddressLocations(patientMap, token);
        for (const [id, loc] of patientAddressLocationMap) {
            locationMap.set(id, loc);
        }

        enrichPatientLocations(patientMap, locationMap);

        const facilityMap = buildFacilityMap(facility, locationMap);

        const records = [];
        const cvdEncounterIds = screeningCvd.map(e => e.id);
        const [obsMap, glucoseMap] = await Promise.all([
            fetchObservationsByEncounter(cvdEncounterIds, token),
            fetchGlucoseByPatient([...patientIds], token)
        ]);
        // 🔥 MAIN LOOP (use MAIN encounters)
        for (const enc of screeningMain) {
            const patientId = getIdFromRef(enc.subject);
            if (!patientId) continue;

            const patient = patientMap.get(patientId);
            if (!patient) continue;

            // 🔥 Observations come from patient (already grouped)
            const cvdEncounter = cvdToMainMap.get(enc.id);
            const encounterObs = cvdEncounter
                ? (obsMap.get(cvdEncounter.id) || {})
                : {};

            const patientObs = glucoseMap.get(patientId) || {};

            // 🔥 Merge
            const obs = {
                ...encounterObs,
                ...patientObs
            };

            const facilityName = facilityMap.get(patientId);
            const screeningDate =
                screeningDateMap.get(enc.id) ||
                enc.period?.start ||
                null;
            const record = {
                ...buildRecord(
                    patient,
                    obs,
                    locationMap,
                    enc,
                    facilityName
                ),
                screeningDate
            };

            records.push(record);
        }

        return res.json({
            status: 1,
            data: records,
            total: records.length
        });

    } catch (error) {
        console.error("Dashboard Error:", error);
        return handleError(res, error);
    }
}

module.exports = { getScreeningSiteDashboard };