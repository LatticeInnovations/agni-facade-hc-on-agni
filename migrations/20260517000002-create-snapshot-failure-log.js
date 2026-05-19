'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {

        // Schema must already exist from the previous migration
        await queryInterface.createTable(
            {  tableName: 'snapshot_failure_log' },
            {
                id: {
                    type:          Sequelize.INTEGER,
                    autoIncrement: true,
                    primaryKey:    true
                },

                // Which patient and which row the upsert was targeting
                patient_id: {
                    type:      Sequelize.STRING,
                    allowNull: false
                },
                source_type: {
                    type: Sequelize.ENUM({
                        values: ['facility', 'campaign'],
                        name:   'snapshot_source_type_enum' // This forces PostgreSQL to use your exact name
                    }),
                    allowNull: false
                },

                // Which controller triggered the upsert
                // e.g. 'savePatientData' | 'patchAppointmentData' | 'saveCVDData' | 'setVitalData'
                controller: {
                    type:      Sequelize.STRING(50),
                    allowNull: false
                },

                // Full req.body entry at the time of failure — lets us replay the upsert
                payload: {
                    type:      Sequelize.JSONB,
                    allowNull: false
                },

                // Error detail
                error: {
                    type:      Sequelize.TEXT,
                    allowNull: false
                },
                stack: {
                    type:      Sequelize.TEXT,
                    allowNull: true
                },

                // Set to true once the upsert has been successfully replayed
                resolved: {
                    type:         Sequelize.BOOLEAN,
                    allowNull:    false,
                    defaultValue: false
                },

                created_at: {
                    type:         Sequelize.DATE,
                    allowNull:    false,
                    defaultValue: Sequelize.NOW
                },
                resolved_at: {
                    type:      Sequelize.DATE,
                    allowNull: true
                }
            }
        );

        // Query unresolved failures quickly
        await queryInterface.addIndex(
            {  tableName: 'snapshot_failure_log' },
            ['resolved', 'created_at'],
            { name: 'idx_failure_log_unresolved' }
        );

        // Look up all failures for a specific patient (for manual replay)
        await queryInterface.addIndex(
            {  tableName: 'snapshot_failure_log' },
            ['patient_id'],
            { name: 'idx_failure_log_patient' }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable(
            {  tableName: 'snapshot_failure_log' }
        );
    }
};