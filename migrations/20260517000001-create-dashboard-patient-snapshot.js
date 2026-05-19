'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {

        // ── 1. Create the dashboard schema if it doesn't exist ──────────────
        await queryInterface.sequelize.query(
            `CREATE SCHEMA IF NOT EXISTS dashboard;`
        );

        // ── 2. Create the snapshot table ─────────────────────────────────────
        await queryInterface.createTable(
            // Table is created inside the 'dashboard' schema
            {  tableName: 'dashboard_patient_snapshot' },
            {
                // ── Primary key ─────────────────────────────────────────────
                // Composite PK: one row per patient per source_type.
                // Maximum 2 rows per patient (facility + campaign).
                patient_id: {
                    type:       Sequelize.STRING,
                    allowNull:  false,
                    primaryKey: true,
                    comment:    'FHIR Patient resource id'
                },
                source_type: {
                    type: Sequelize.ENUM({
                        values: ['facility', 'campaign'],
                        name:   'snapshot_source_type_enum' // This forces PostgreSQL to use your exact name
                    }),
                    allowNull:  false,
                    primaryKey: true,
                    name: 'snapshot_source_type_enum',
                    comment:    'facility → facility/division dashboards | campaign → screening-site dashboard'
                },

                // ── Demographics (written by savePatientData) ────────────────
                // Seeds the row on patient creation.
                // Updated on patient update via savePatientData / updatePatientData.
                // Also synced back when address changes.
                patient_name: {
                    type:      Sequelize.STRING,
                    allowNull: true
                },
                dob: {
                    type:      Sequelize.DATEONLY,
                    allowNull: true,
                    comment:   'birthDate from Patient FHIR resource'
                },
                gender: {
                    type:      Sequelize.STRING(10),
                    allowNull: true,
                    comment:   'male | female | other | unknown'
                },

                // Address IDs — stored as strings (FHIR Location resource ids).
                // Duplicated here from patient for fast GROUP BY / filter on
                // division dashboard without a join.
                province_id: {
                    type:      Sequelize.STRING,
                    allowNull: true,
                    comment:   'maps to patient.address.state'
                },
                area_council_id: {
                    type:      Sequelize.STRING,
                    allowNull: true,
                    comment:   'maps to patient.address.city'
                },
                island_id: {
                    type:      Sequelize.STRING,
                    allowNull: true,
                    comment:   'maps to patient.address.district'
                },
                village_id: {
                    type:      Sequelize.STRING,
                    allowNull: true,
                    comment:   'maps to patient.address.line[0] — non-mandatory'
                },

                // ── Appointment anchor (written by setAppointmentData + patchAppointmentData) ──
                // appointment_id and screening_date always move together atomically.
                // screening_date only advances forward (GREATEST rule).
                // appointment_id tracks which appointment produced the current screening_date —
                // used to resolve status-only patches that carry no slot date.
                appointment_id: {
                    type:      Sequelize.STRING,
                    allowNull: true,
                    comment:   'FHIR Appointment id that produced the current screening_date'
                },
                facility_id: {
                    type:      Sequelize.STRING,
                    allowNull: true,
                    comment:   'Organization FHIR id — set when source_type=facility'
                },
                campaign_id: {
                    type:      Sequelize.STRING,
                    allowNull: true,
                    comment:   'Location FHIR id — set when source_type=campaign'
                },
                screening_date: {
                    type:      Sequelize.DATE,
                    allowNull: true,
                    comment:   'slot.start of the latest appointment — always written on POST, advanced on PATCH if newer'
                },

                // ── CVD fields (written by saveCVDData) ──────────────────────
                // Merge rule: newer appt → overwrite. Older appt → fill nulls only.
                sys_bp: {
                    type:      Sequelize.INTEGER,
                    allowNull: true
                },
                dia_bp: {
                    type:      Sequelize.INTEGER,
                    allowNull: true
                },
                bmi: {
                    type:      Sequelize.FLOAT,
                    allowNull: true
                },
                smoker: {
                    type:      Sequelize.SMALLINT,
                    allowNull: true,
                    comment:   '0 | 1 or code from CVD observation valueCodeableConcept'
                },
                cholesterol: {
                    type:      Sequelize.FLOAT,
                    allowNull: true,
                    comment:   'stored in mmol/L — convert from mg/dL at write time'
                },
                cholesterol_unit: {
                    type:      Sequelize.STRING(20),
                    allowNull: true
                },
                cvd_risk: {
                    type:      Sequelize.INTEGER,
                    allowNull: true,
                    comment:   'CVD risk % from observation'
                },

                // ── Vital fields (written by setVitalData) ───────────────────
                glucose: {
                    type:      Sequelize.FLOAT,
                    allowNull: true,
                    comment:   'stored in mmol/L — convert from mg/dL at write time'
                },
                glucose_unit: {
                    type:      Sequelize.STRING(20),
                    allowNull: true
                },
                glucose_type: {
                    type:      Sequelize.STRING(20),
                    allowNull: true,
                    comment:   'fasting | random'
                },

                // ── Metadata ─────────────────────────────────────────────────
                updated_at: {
                    type:         Sequelize.DATE,
                    allowNull:    false,
                    defaultValue: Sequelize.NOW
                }
            }
        );

        // ── 3. Composite indexes ──────────────────────────────────────────────
        // All indexes include source_type as the leading column so the planner
        // can skip rows of the wrong type before applying the business filter.

        // Facility dashboard: WHERE source_type=facility AND facility_id AND date range
        await queryInterface.addIndex(
            {  tableName: 'dashboard_patient_snapshot' },
            ['source_type', 'facility_id', 'screening_date'],
            { name: 'idx_snapshot_facility_date' }
        );

        // Division dashboard — province
        await queryInterface.addIndex(
            {  tableName: 'dashboard_patient_snapshot' },
            ['source_type', 'province_id', 'screening_date'],
            { name: 'idx_snapshot_province_date' }
        );

        // Division dashboard — area council
        await queryInterface.addIndex(
            {  tableName: 'dashboard_patient_snapshot' },
            ['source_type', 'area_council_id', 'screening_date'],
            { name: 'idx_snapshot_council_date' }
        );

        // Division dashboard — island
        await queryInterface.addIndex(
            {  tableName: 'dashboard_patient_snapshot' },
            ['source_type', 'island_id', 'screening_date'],
            { name: 'idx_snapshot_island_date' }
        );

        // Screening site dashboard: WHERE source_type=campaign AND campaign_id
        await queryInterface.addIndex(
            {  tableName: 'dashboard_patient_snapshot' },
            ['source_type', 'campaign_id'],
            { name: 'idx_snapshot_campaign' }
        );

        // Appointment id lookup — trace snapshot back to source appointment
        await queryInterface.addIndex(
            {  tableName: 'dashboard_patient_snapshot' },
            ['appointment_id'],
            { name: 'idx_snapshot_appointment_id' }
        );

        // Gender graph — GROUP BY gender
        await queryInterface.addIndex(
            {  tableName: 'dashboard_patient_snapshot' },
            ['source_type', 'gender'],
            { name: 'idx_snapshot_gender' }
        );

        // Patient lookup (for upsert and join)
        await queryInterface.addIndex(
            {  tableName: 'dashboard_patient_snapshot' },
            ['patient_id'],
            { name: 'idx_snapshot_patient_id' }
        );

        // Freshness / monitoring
        await queryInterface.addIndex(
            {  tableName: 'dashboard_patient_snapshot' },
            ['updated_at'],
            { name: 'idx_snapshot_updated_at' }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable(
            {  tableName: 'dashboard_patient_snapshot' }
        );
        // Do not drop the schema itself — other tables may exist
    }
};