'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class NationalIdentity extends Model {
    static associate(models) {}
  }

  NationalIdentity.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,           // ← actual primary key
      autoIncrement: true,
    },
    nationalId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,               // camelCase column, no field mapping needed
    },
    firstName:  { type: DataTypes.STRING,  allowNull: false },
    middleName: { type: DataTypes.STRING,  allowNull: false },
    lastName:   { type: DataTypes.STRING,  allowNull: false },
    dob:        { type: DataTypes.DATEONLY, allowNull: false },
    gender:     { type: DataTypes.STRING,  allowNull: false },
    dataHash: {
      type: DataTypes.CHAR(32),
      allowNull: true,
      field: 'data_hash',         // ← snake_case column in DB
    },
  }, {
    sequelize,
    modelName: 'NationalIdentity',
    tableName: 'national_identity',
    timestamps: true,
    createdAt: 'created_at',      // ← map to snake_case timestamp columns
    updatedAt: 'updated_at',
  });

  return NationalIdentity;
};