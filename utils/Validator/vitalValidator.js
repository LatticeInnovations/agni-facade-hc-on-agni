const Joi = require("joi");

// Schema for a single vital entry
const vitalSchema = Joi.object({
  vitalUuid: Joi.string().uuid().required(),
  appointmentId: Joi.string().required(),
  patientId: Joi.string().required(),

  heightFt: Joi.alternatives().try(Joi.number(), Joi.string()).allow("", null).optional(),
  heightInch: Joi.alternatives().try(Joi.number(), Joi.string()).allow("", null).optional(),
  heightCm: Joi.alternatives().try(Joi.number(), Joi.string()).allow("", null).optional(),

  weight: Joi.alternatives().try(Joi.number().allow("", null), Joi.string()).optional(),
  heartRate: Joi.alternatives().try(Joi.number().allow("", null), Joi.string()).optional(),
  respRate: Joi.alternatives().try(Joi.number().allow("", null), Joi.string()).optional(),
  spo2: Joi.alternatives().try(Joi.number().allow("", null), Joi.string()).optional(),
  temp: Joi.alternatives().try(Joi.number().allow("", null), Joi.string()).optional(),

  tempUnit: Joi.string().valid("C", "F").optional(),

  bpDiastolic: Joi.alternatives().try(Joi.number(), Joi.string()).allow("", null).optional(),
  bpSystolic: Joi.alternatives().try(Joi.number(), Joi.string()).allow("", null).optional(),

  bloodGlucose: Joi.alternatives().try(Joi.number(), Joi.string()).allow("", null).optional(),
  bloodGlucoseType: Joi.string().valid("fasting", "random").allow("", null).optional(),
  bloodGlucoseUnit: Joi.string().valid("mg/dL", "mmol/L").allow("", null).optional(),

  leftEye: Joi.alternatives().try(Joi.number(), Joi.string()).allow("", null).optional(),
  rightEye: Joi.alternatives().try(Joi.number(), Joi.string()).allow("", null).optional(),
  eyeTestType: Joi.string().valid("1", "2").allow("", null).optional(),
  createdOn: Joi.string().isoDate().required()
});

// Schema for an array of vital entries
const vitalSaveSchema = Joi.array().items(vitalSchema);

module.exports = {vitalSaveSchema}