'use strict';

/**
 * upsertSnapshot.js
 *
 * One exported function per facade controller that writes to the snapshot table.
 * All functions use a raw SQL upsert (via dashboardDb.query) rather than
 * Sequelize's upsert() because the clinical merge rule (GREATEST / COALESCE
 * logic per column) cannot be expressed through the ORM's upsert API.
 *
 * Exported functions:
 *   upsertSnapshotPatient      — called by savePatientData / updatePatientData
 *   upsertSnapshotAppointment  — called by setAppointmentData (POST) + patchAppointmentData (PATCH)
 *   upsertSnapshotCVD          — called by saveCVDData
 *   upsertSnapshotVital        — called by setVitalData
 *
 * Unit conversion helpers (mg/dL → mmol/L) are kept here so conversions
 * happen once at write time and the dashboard always reads a single unit.
 */

const { QueryTypes } = require('sequelize');
const sequelize = require('../models').sequelize;

// ─────────────────────────────────────────────────────────────────────────────
// Unit conversion
// ─────────────────────────────────────────────────────────────────────────────

const GLUCOSE_MGDL_TO_MMOL    = 0.0555;
const CHOLESTEROL_MGDL_TO_MMOL = 0.02586;

/**
 * Normalise glucose to mmol/L.
 * Returns { value, unit } always in mmol/L.
 */
const normaliseGlucose = (value, unit) => {
    if (value == null) return { value: null, unit: null };
    const v = parseFloat(value);
    if (isNaN(v))      return { value: null, unit: null };
    if (unit === 'mg/dL') return { value: parseFloat((v * GLUCOSE_MGDL_TO_MMOL).toFixed(4)), unit: 'mmol/L' };
    return { value: v, unit: unit || 'mmol/L' };
};

/**
 * Normalise cholesterol to mmol/L.
 */
const normaliseCholesterol = (value, unit) => {
    if (value == null) return { value: null, unit: null };
    const v = parseFloat(value);
    if (isNaN(v))      return { value: null, unit: null };
    if (unit === 'mg/dL') return { value: parseFloat((v * CHOLESTEROL_MGDL_TO_MMOL).toFixed(4)), unit: 'mmol/L' };
    return { value: v, unit: unit || 'mmol/L' };
};

// ─────────────────────────────────────────────────────────────────────────────
// Internal raw query runner
// ─────────────────────────────────────────────────────────────────────────────

const run = async (sql, replacements) =>
     await sequelize.query(sql, {
        replacements,
        type: QueryTypes.RAW
    });

// ─────────────────────────────────────────────────────────────────────────────
// 1. upsertSnapshotPatient
//    Called by: savePatientData (POST) and updatePatientData (PUT)
//
//    insert/update BOTH rows (facility + campaign) for the patient with demographic
//    data. Clinical and appointment fields are left untouched on conflict so
//    a patient update never wipes assessment data.
//
//    Address fields are also synced here so division dashboard filters
//    (province, island, council) are always current.
// ─────────────────────────────────────────────────────────────────────────────

const upsertSnapshotPatient = async (patientData) => {
    try {
        console.log(patientData);
            const {
       fhirId,
        firstName,
        lastName,
        birthDate,
        gender,
        permanentAddress,
    } = patientData;
    const patientId = fhirId
    const patientName  = [firstName, lastName].filter(Boolean).join(' ') || null;
    const provinceId   = permanentAddress?.state        || null;   // province → state
    const councilId    = permanentAddress?.city         || null;   // area-council → city
    const islandId     = permanentAddress?.district     || null;   // island → district
    const villageId    = permanentAddress?.addressLine1 || null;   // village → line[0]
    // Upsert both source_type rows in one call 
    // create a temp table and then insert from it with ON CONFLICT to avoid potential 
    // race conditions and ensure atomicity of the operation across both rows, 
    // rather than doing two separate upserts which could interleave with other operations on the same patient.
   
    // DB once rather than twice.
    const sql = `
        INSERT INTO dashboard_patient_snapshot
            (patient_id, source_type,
             patient_name, dob, gender,
             province_id, area_council_id, island_id, village_id,
             updated_at)
        SELECT
            :patientId, t.source_type::enum_dashboard_patient_snapshot_source_type,
            :patientName, :dob, :gender,
            :provinceId, :councilId, :islandId, :villageId,
            NOW()
        FROM (VALUES ('facility'), ('campaign')) AS t(source_type)
        ON CONFLICT (patient_id, source_type) DO UPDATE SET
            patient_name    = EXCLUDED.patient_name,
            dob             = EXCLUDED.dob,
            gender          = EXCLUDED.gender,
            province_id     = EXCLUDED.province_id,
            area_council_id = EXCLUDED.area_council_id,
            island_id       = EXCLUDED.island_id,
            village_id      = EXCLUDED.village_id,
            updated_at      = NOW()
    `;

    await run(sql, {
        patientId: fhirId,
        patientName,
        dob:        birthDate  || null,
        gender:     gender     || null,
        provinceId,
        councilId,
        islandId,
        villageId
    });
    }
    catch (err) {
        console.error("Error in upsertSnapshotPatient:", err);
        throw err; // Let the caller handle logging and decide whether to fail silently or escalate.
    }

};

// ─────────────────────────────────────────────────────────────────────────────
// 2. upsertSnapshotAppointment
//    Called by: setAppointmentData (POST) and patchAppointmentData (PATCH)
//
//    POST — always writes appointment_id + screening_date regardless of status.
//           facility_id (from req.decoded.orgId) or campaign_id written here.
//
//    PATCH — two cases:
//      a. Status-only patch (no slot in body): screeningDate = null →
//         COALESCE keeps existing screening_date and appointment_id unchanged.
//      b. Slot reschedule patch: screeningDate provided →
//         GREATEST rule applies — only advances if newer.
//
//    Status gate is applied BEFORE calling this function in the controller.
//    This function is never called for cancelled / noshow / scheduled (facility).
// ─────────────────────────────────────────────────────────────────────────────

const upsertSnapshotAppointment = async (apptData) => {
    try {
            const {
    patientId,
    appointmentId,      // location id — campaign rows only, null for facility
    slot,
    sourceType
        // slot.start — null means status-only patch, keep existing
} = apptData;

const screeningDate = slot?.start ? new Date(slot.start) : null;
const facilityId = apptData.orgId || null;
const campaignId = apptData.campaignId || null;
const apptStatus = apptData.status || null;
console.log("upsertSnapshotAppointment data:", { patientId, appointmentId, screeningDate, sourceType, facilityId, campaignId, apptStatus });
    const sql = `
        INSERT INTO dashboard_patient_snapshot
            (patient_id, source_type,
             appointment_id,  appointment_status, facility_id, campaign_id, screening_date,
             updated_at)
        VALUES
            (:patientId, :sourceType,
            :appointmentId, :apptStatus, :facilityId, :campaignId, :screeningDate,
             NOW())
        ON CONFLICT (patient_id, source_type) DO UPDATE SET
 
            -- appointment_id and screening_date move together atomically.
            -- If incoming screeningDate is NULL (status-only PATCH):
            --   keep existing appointment_id and screening_date unchanged.
            -- If incoming screeningDate is provided:
            --   only advance if newer (GREATEST rule).
            --   COALESCE with '-infinity' handles the case where existing
            --   screening_date is NULL so GREATEST does not swallow the incoming date.
            appointment_id = CASE
                WHEN EXCLUDED.screening_date IS NULL
                    THEN dashboard_patient_snapshot.appointment_id
                WHEN dashboard_patient_snapshot.screening_date IS NULL
                    THEN EXCLUDED.appointment_id
                WHEN EXCLUDED.screening_date > dashboard_patient_snapshot.screening_date
                    THEN EXCLUDED.appointment_id
                ELSE dashboard_patient_snapshot.appointment_id
            END,
 
            screening_date = CASE
                WHEN EXCLUDED.screening_date IS NULL
                    THEN dashboard_patient_snapshot.screening_date
                ELSE GREATEST(
                    COALESCE(dashboard_patient_snapshot.screening_date, '-infinity'::timestamp),
                    EXCLUDED.screening_date
                )
            END,
 
            -- appointment_status is always overwritten — no gate here.
            -- Facility/division dashboard applies:
            --   WHERE appointment_status IN ('in-progress', 'completed')
            -- Screening-site dashboard applies no status filter.
            -- This means a cancelled appointment correctly disappears from
            -- the facility dashboard without any special controller logic.
            appointment_status = EXCLUDED.appointment_status,
 
            -- facility_id / campaign_id: only overwrite if incoming is not null
            -- (status-only PATCH may not carry these values)
            facility_id = COALESCE(EXCLUDED.facility_id, dashboard_patient_snapshot.facility_id),
            campaign_id = COALESCE(EXCLUDED.campaign_id, dashboard_patient_snapshot.campaign_id),
 
            updated_at = NOW()
    `;

    await run(sql, {
        patientId,
        sourceType,
        apptStatus:    apptStatus,
        appointmentId: appointmentId || null,
        facilityId:    facilityId    || null,
        campaignId:    campaignId    || null,
        screeningDate: screeningDate || null
    });

    }
    catch (err) {
        console.error("Error in upsertSnapshotAppointment:", err);
        throw err; // Let the caller handle logging and decide whether to fail silently or escalate.
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. upsertSnapshotCVD
//    Called by: saveCVDData (POST — same controller handles facility + campaign)
//
//    Clinical merge rule:
//      incoming appointment newer than snapshot screening_date
//        → overwrite all non-null incoming fields
//      incoming appointment older than snapshot screening_date
//        → COALESCE(existing, incoming) — fill nulls only
//
//    Cholesterol converted to mmol/L at write time.
// ─────────────────────────────────────────────────────────────────────────────

const normaliseCholesterol = (value, unit) => {
    if (value == null) return { value: null, unit: null };
    const v = parseFloat(value);
    if (isNaN(v))         return { value: null, unit: null };
    if (unit === 'mg/dL') return { value: parseFloat((v * CHOLESTEROL_MGDL_TO_MMOL).toFixed(4)), unit: 'mmol/L' };
    return { value: v, unit: unit || 'mmol/L' };
};

const upsertSnapshotCVD = async ({
    patientId,
    sourceType,
    screeningDate,    // slot.start of the appointment this CVD record belongs to
    bpSystolic,
    bpDiastolic,
    bmi,
    smoker,
    cholesterol,
    cholesterolUnit,
    risk
}) => {
    const chol = normaliseCholesterol(cholesterol, cholesterolUnit);

    const sql = `
        INSERT INTO dashboard_patient_snapshot
            (patient_id, source_type,
             sys_bp, dia_bp, bmi, smoker,
             cholesterol, cholesterol_unit, cvd_risk,
             updated_at)
        VALUES
            (:patientId, :sourceType,
             :sysBP, :diaBP, :bmi, :smoker,
             :cholesterol, :cholesterolUnit, :risk,
             NOW())
        ON CONFLICT (patient_id, source_type) DO UPDATE SET

            -- For each clinical field:
            -- If incoming appointment is newer (or existing screening_date not set yet):
            --   take incoming value if not null, else keep existing
            -- If incoming appointment is older:
            --   keep existing if not null, else fall back to incoming (lookback fill)

            sys_bp = CASE
                WHEN dashboard_patient_snapshot.screening_date IS NULL
                  OR :screeningDate::timestamptz >= dashboard_patient_snapshot.screening_date
                    THEN COALESCE(EXCLUDED.sys_bp,  dashboard_patient_snapshot.sys_bp)
                ELSE COALESCE(dashboard_patient_snapshot.sys_bp, EXCLUDED.sys_bp)
            END,

            dia_bp = CASE
                WHEN dashboard_patient_snapshot.screening_date IS NULL
                  OR :screeningDate::timestamptz >= dashboard_patient_snapshot.screening_date
                    THEN COALESCE(EXCLUDED.dia_bp, dashboard_patient_snapshot.dia_bp)
                ELSE COALESCE(dashboard_patient_snapshot.dia_bp, EXCLUDED.dia_bp)
            END,

            bmi = CASE
                WHEN dashboard_patient_snapshot.screening_date IS NULL
                  OR :screeningDate::timestamptz >= dashboard_patient_snapshot.screening_date
                    THEN COALESCE(EXCLUDED.bmi, dashboard_patient_snapshot.bmi)
                ELSE COALESCE(dashboard_patient_snapshot.bmi, EXCLUDED.bmi)
            END,

            smoker = CASE
                WHEN dashboard_patient_snapshot.screening_date IS NULL
                  OR :screeningDate::timestamptz >= dashboard_patient_snapshot.screening_date
                    THEN COALESCE(EXCLUDED.smoker, dashboard_patient_snapshot.smoker)
                ELSE COALESCE(dashboard_patient_snapshot.smoker, EXCLUDED.smoker)
            END,

           cholesterol = CASE
                WHEN dashboard_patient_snapshot.screening_date IS NULL
                  OR :screeningDate::timestamptz >= dashboard_patient_snapshot.screening_date
                    THEN COALESCE(EXCLUDED.cholesterol, dashboard_patient_snapshot.cholesterol)
                ELSE COALESCE(dashboard_patient_snapshot.cholesterol, EXCLUDED.cholesterol)
            END,

            -- LOCKED-IN RULE: Anchored the unit string directly to the incoming numerical cholesterol value.
            -- This prevents units from decoupling when partial offline forms sync out of sequence.
            cholesterol_unit = CASE
                WHEN dashboard_patient_snapshot.screening_date IS NULL
                  OR :screeningDate::timestamptz >= dashboard_patient_snapshot.screening_date
                    THEN CASE 
                        WHEN EXCLUDED.cholesterol IS NOT NULL THEN EXCLUDED.cholesterol_unit 
                        ELSE dashboard_patient_snapshot.cholesterol_unit 
                    END
                ELSE COALESCE(dashboard_patient_snapshot.cholesterol_unit, EXCLUDED.cholesterol_unit)
            END,

            cvd_risk = CASE
                WHEN dashboard_patient_snapshot.screening_date IS NULL
                  OR :screeningDate::timestamptz >= dashboard_patient_snapshot.screening_date
                    THEN COALESCE(EXCLUDED.cvd_risk, dashboard_patient_snapshot.cvd_risk)
                ELSE COALESCE(dashboard_patient_snapshot.cvd_risk, EXCLUDED.cvd_risk)
            END,

            updated_at = NOW()
    `;

    await run(sql, {
        patientId,
        sourceType,
        screeningDate: screeningDate || null,
        sysBP:         bpSystolic    != null ? parseInt(bpSystolic)  : null,
        diaBP:         bpDiastolic   != null ? parseInt(bpDiastolic) : null,
        bmi:           bmi           != null ? parseFloat(bmi)         : null,
        smoker:        smoker        != null ? parseInt(smoker)          : null,
        cholesterol:   chol.value,
        cholesterolUnit: chol.unit,
        risk:       cvdRisk       != null ? parseInt(cvdRisk)     : null
    });
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. upsertSnapshotVital
//    Called by: setVitalData (POST — same controller handles facility + campaign)
//
//    Only glucose is shown on the dashboard currently.
//    Glucose converted to mmol/L at write time.
//    Same clinical merge rule as CVD.
// ─────────────────────────────────────────────────────────────────────────────

const upsertSnapshotVital = async ({
    patientId,
    sourceType,
    screeningDate,    
    glucoseValue,
    glucoseUnit,
    glucoseType
}) => {
    const glucose = normaliseGlucose(glucoseValue, glucoseUnit);

    // FIXED: fully qualified schema path added
    const sql = `
        INSERT INTO dashboard_patient_snapshot
            (patient_id, source_type,
             glucose, glucose_unit, glucose_type,
             updated_at)
        VALUES
            (:patientId, :sourceType,
             :glucose, :glucoseUnit, :glucoseType,
             NOW())
        ON CONFLICT (patient_id, source_type) DO UPDATE SET

            glucose = CASE
                WHEN dashboard_patient_snapshot.screening_date IS NULL
                  OR :screeningDate::timestamptz >= dashboard_patient_snapshot.screening_date
                    THEN COALESCE(EXCLUDED.glucose, dashboard_patient_snapshot.glucose)
                ELSE COALESCE(dashboard_patient_snapshot.glucose, EXCLUDED.glucose)
            END,

            -- FIXED: Anchored metadata tags directly to the presence of an incoming numerical value.
            -- This prevents units and types from decoupling when partial offline forms sync out of sequence.
            glucose_unit = CASE
                WHEN dashboard_patient_snapshot.screening_date IS NULL
                  OR :screeningDate::timestamptz >= dashboard_patient_snapshot.screening_date
                    THEN CASE WHEN EXCLUDED.glucose IS NOT NULL THEN EXCLUDED.glucose_unit ELSE dashboard_patient_snapshot.glucose_unit END
                ELSE COALESCE(dashboard_patient_snapshot.glucose_unit, EXCLUDED.glucose_unit)
            END,

            glucose_type = CASE
                WHEN dashboard_patient_snapshot.screening_date IS NULL
                  OR :screeningDate::timestamptz >= dashboard_patient_snapshot.screening_date
                    THEN CASE WHEN EXCLUDED.glucose IS NOT NULL THEN EXCLUDED.glucose_type ELSE dashboard_patient_snapshot.glucose_type END
                ELSE COALESCE(dashboard_patient_snapshot.glucose_type, EXCLUDED.glucose_type)
            END,

            updated_at = NOW()
    `;

    await run(sql, {
        patientId,
        sourceType,
        screeningDate: screeningDate    || null,
        glucose:       glucose.value,
        glucoseUnit:   glucose.unit,
        glucoseType:   glucoseType      || null
    });
};
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
    upsertSnapshotPatient,
    upsertSnapshotAppointment,
    upsertSnapshotCVD,
    upsertSnapshotVital
};