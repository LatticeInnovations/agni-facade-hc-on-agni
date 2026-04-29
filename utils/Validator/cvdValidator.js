const Joi = require("joi");

// Schema for one CVD entry
const cvdSchema = Joi.object({
  uuid: Joi.string().uuid().required(),
  appointmentId: Joi.string().required(),
  patientId: Joi.string().required(),
  appUpdatedDate: Joi.date().optional(),
  heightFt: Joi.number().allow(null).optional(),
  heightInch: Joi.number().allow(null).optional(),
  heightCm: Joi.number().allow(null).optional(),

  weight: Joi.number().allow(null).required(),
  weightUnit: Joi.string().allow("kg", "lb").required(),
  bpDiastolic: Joi.number().allow(null).optional(),
  bpSystolic: Joi.number().allow(null).optional(),

  diabetic: Joi.number().allow(null).valid(0, 1).required(),
  smoker: Joi.number().allow(null).valid(0, 1).required(),

  cholesterol: Joi.number().allow(null).optional(),
  cholesterolUnit: Joi.string().allow(null, "", "mmol/L", "mg/dl").optional(),

  bmi: Joi.number().allow(null).required(),
  risk: Joi.number().allow(null).min(0).max(100).optional(),
  heartAttackHistory: Joi.number().allow(null).required(),
  screeningDate: Joi.date().allow(null).required(),
  chiefComplaint: Joi.string().allow(null, "").optional(),


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
  risk: Joi.number()
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