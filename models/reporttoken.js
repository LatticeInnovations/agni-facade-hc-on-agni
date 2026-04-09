'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ReportToken extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  ReportToken.init({
    token: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
    },

    appointmentId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },

    patientId: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    dob: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    fileName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    sequelize,
    modelName: 'ReportToken',
    tableName: 'report_token',
    timestamps: true,
  });
  return ReportToken;
};