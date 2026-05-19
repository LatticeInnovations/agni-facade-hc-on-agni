'use strict';

const { DataTypes, Model } = require('sequelize');


module.exports = (sequelize, DataTypes) => {
  class DashboardPatientSnapshot extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.belongsTo(models.hfj_resource, {
        foreignKey: "user_id",
        targetKey: "res_id"
      });
    }
  }

DashboardPatientSnapshot.init(
    {
        patient_id: {
            type:       DataTypes.STRING,
            primaryKey: true
        },
        source_type: {
          type: DataTypes.ENUM({
              values: ['facility', 'campaign'],
              name: 'snapshot_source_type_enum' 
          }),
          primaryKey: true
      },

        // Demographics
        patient_name:    { type: DataTypes.STRING,   allowNull: true },
        dob:             { type: DataTypes.DATEONLY,  allowNull: true },
        gender:          { type: DataTypes.STRING(10), allowNull: true },
        province_id:     { type: DataTypes.STRING,   allowNull: true },
        area_council_id: { type: DataTypes.STRING,   allowNull: true },
        island_id:       { type: DataTypes.STRING,   allowNull: true },
        village_id:      { type: DataTypes.STRING,   allowNull: true },

        // Appointment anchor
        appointment_id: { type: DataTypes.STRING, allowNull: true, comment: 'FHIR Appointment id that produced the current screening_date' },
         appointment_status: {
            type:      DataTypes.STRING(20),
            allowNull: true,
            comment:   'scheduled | arrived | walkin | in-progress | completed | noshow | cancelled'
        },
        facility_id:    { type: DataTypes.STRING,  allowNull: true },
        campaign_id:    { type: DataTypes.STRING,  allowNull: true },
        screening_date: { type: DataTypes.DATE,    allowNull: true },

        // CVD
        sys_bp:           { type: DataTypes.INTEGER, allowNull: true },
        dia_bp:           { type: DataTypes.INTEGER, allowNull: true },
        bmi:              { type: DataTypes.FLOAT, allowNull: true },
        smoker:           { type: DataTypes.SMALLINT, allowNull: true },
        cholesterol:      { type: DataTypes.FLOAT, allowNull: true },
        cholesterol_unit: { type: DataTypes.STRING(20), allowNull: true },
        cvd_risk:         { type: DataTypes.INTEGER, allowNull: true },

        // Vitals
        glucose:       { type: DataTypes.FLOAT, allowNull: true },
        glucose_unit:  { type: DataTypes.STRING(20), allowNull: true },
        glucose_type:  { type: DataTypes.STRING(20), allowNull: true },

        updated_at: {
            type:         DataTypes.DATE,
            allowNull:    false,
            defaultValue: DataTypes.NOW
        }
    },
    {
        sequelize,
        modelName:  'DashboardPatientSnapshot',
        tableName:  'dashboard_patient_snapshot',
        timestamps: false,
        underscored: true
    }
);

  return DashboardPatientSnapshot;
}