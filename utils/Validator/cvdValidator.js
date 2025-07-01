const Joi = require("joi");

// Schema for one CVD entry
const cvdSchema = Joi.object({
  cvdUuid: Joi.string().uuid().required(),
  appointmentId: Joi.string().required(),
  patientId: Joi.string().required(),

  heightFt: Joi.number().allow(null).optional(),
  heightInch: Joi.number().allow(null).optional(),
  heightCm: Joi.number().allow(null).optional(),

  weight: Joi.number().allow(null).optional(),

  bpDiastolic: Joi.number().allow(null).optional(),
  bpSystolic: Joi.number().allow(null).optional(),

  diabetic: Joi.number().allow(null).valid(0, 1).optional(),
  smoker: Joi.number().allow(null).valid(0, 1).optional(),

  cholesterol: Joi.number().allow(null).optional(),
  cholesterolUnit: Joi.string().allow(null).optional(),

  bmi: Joi.number().allow(null).optional(),
  risk: Joi.number().allow(null).min(0).max(100).optional(),

  createdOn: Joi.string().isoDate().required()
});

// Schema for an array of CVD entries
const cvdSaveSchema = Joi.array().items(cvdSchema);


// Optional fields schema (used inside `component`)
const componentValueSchema = Joi.object({
  operation: Joi.string().valid("add", "replace", "remove").required(),

  weight: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
  heightCm: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
  bmi: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
  bpDiastolic: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
  bpSystolic: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
  cholesterol: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
  cholesterolUnit: Joi.string().valid("mg/dl", "mmol/L").optional(),
  diabetic: Joi.number().valid(0, 1).optional(),
  smoker: Joi.number().valid(0, 1).optional(),
  risk: Joi.alternatives().try(Joi.number(), Joi.string()).optional()
}).custom((value, helpers) => {
  // Ensure at least one field other than "operation" is present
  const keys = Object.keys(value).filter(k => k !== 'operation');
  if (value.operation !== 'remove' && keys.length === 0) {
    return helpers.error("any.invalid", { message: "At least one field must be provided in component when operation is not 'remove'" });
  }
  return value;
});

// Main PATCH object schema
const cvdPatchSchema = Joi.object({
  cvdFhirId: Joi.string().required(),
  key: Joi.string().required(),
  component: componentValueSchema.required()
});

// Schema for array of PATCH operations
const cvdPatchArraySchema = Joi.array().items(cvdPatchSchema);



module.exports = {cvdSaveSchema, cvdPatchArraySchema}