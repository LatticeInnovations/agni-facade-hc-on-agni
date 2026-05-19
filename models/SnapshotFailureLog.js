'use strict';

const { DataTypes, Model } = require('sequelize');



module.exports = (sequelize, DataTypes) => {
  class SnapshotFailureLog extends Model {
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

SnapshotFailureLog.init(
    {
        id: {
            type:          DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey:    true
        },
        patient_id:  { type: DataTypes.STRING, allowNull: false },
        source_type: {
          type: DataTypes.ENUM({
              values: ['facility', 'campaign'],
              name: 'snapshot_source_type_enum' 
          }),
          primaryKey: true
      },
        controller:  { type: DataTypes.STRING(50), allowNull: false },
        payload:     { type: DataTypes.JSONB, allowNull: false },
        error:       { type: DataTypes.TEXT, allowNull: false },
        stack:       { type: DataTypes.TEXT, allowNull: true },
        resolved:    { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        created_at:  { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        resolved_at: { type: DataTypes.DATE, allowNull: true }
    },
    {
         sequelize,
        modelName:   'SnapshotFailureLog',
        tableName:   'snapshot_failure_log',
        timestamps:  false,
        underscored: true
    }
)

return SnapshotFailureLog;
}
