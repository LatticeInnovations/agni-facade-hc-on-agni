'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {

        // ── 1. Add appointment_status column ─────────────────────────────────
        await queryInterface.addColumn(
            'dashboard_patient_snapshot',
            'appointment_status',
            {
                type:      Sequelize.STRING(20),
                allowNull: true,
                comment:   'Latest appointment status for this patient row. ' +
                           'Facility/division dashboard filters on in-progress|completed. ' +
                           'Screening-site dashboard does not filter on status. ' +
                           'Values: scheduled | arrived | walkin | in-progress | completed | noshow | cancelled'
            }
        );

        // ── 2. Add composite index for facility/division dashboard filter ─────
        // The dashboard WHERE clause is:
        //   source_type = 'facility'
        //   AND facility_id = ANY(...)
        //   AND screening_date BETWEEN ...
        //   AND appointment_status IN ('in-progress', 'completed')
        // Including appointment_status in the index lets PG skip non-qualifying
        // rows without a heap fetch.
        await queryInterface.addIndex(
            'dashboard_patient_snapshot',
            ['source_type', 'facility_id', 'appointment_status', 'screening_date'],
            { name: 'idx_snapshot_facility_status_date' }
        );

        // ── 3. Drop the old index that is now superseded ──────────────────────
        // idx_snapshot_facility_date only covered (source_type, facility_id, screening_date).
        // The new index above covers all four columns so the old one is redundant.
        await queryInterface.removeIndex(
            'dashboard_patient_snapshot',
            'idx_snapshot_facility_date'
        );
    },

    async down(queryInterface) {
        // Restore original index before removing column
        await queryInterface.addIndex(
            'dashboard_patient_snapshot',
            ['source_type', 'facility_id', 'screening_date'],
            { name: 'idx_snapshot_facility_date' }
        );

        await queryInterface.removeIndex(
            'dashboard_patient_snapshot',
            'idx_snapshot_facility_status_date'
        );

        await queryInterface.removeColumn(
            'dashboard_patient_snapshot',
            'appointment_status'
        );
    }
};