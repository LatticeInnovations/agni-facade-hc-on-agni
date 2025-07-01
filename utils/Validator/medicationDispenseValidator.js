const Joi = require("joi");

// Common med fields
const commonMedFields = {
  medDispenseUuid: Joi.string().uuid().required(),
  qtyDispensed: Joi.number().required(),
  category: Joi.string().valid("prescribed", "OTC").required(),
  medNote: Joi.alternatives().try(Joi.string(), Joi.allow(null)).optional(),
  isModified: Joi.boolean().required(),
  medFhirId: Joi.string().required(),
  modificationType: Joi.alternatives().try(Joi.string(), Joi.allow(null)).optional()
};

// Prescribed-only fields
const prescribedMedFields = {
  medReqFhirId: Joi.string().required()
};

// Prescribed medication schema
const prescribedMedicineSchema = Joi.object({
  ...commonMedFields,
  ...prescribedMedFields
});

// OTC medication schema (no medReqFhirId)
const otcMedicineSchema = Joi.object(commonMedFields);

// Prescribed dispense block
const prescribedDispenseSchema = Joi.object({
  prescriptionFhirId: Joi.string().required(),
  generatedOn: Joi.string().isoDate().required(),
  patientId: Joi.string().required(),
  status: Joi.string().valid("partially-dispensed", "fully-dispensed").required(),
  note: Joi.alternatives().try(Joi.string(), Joi.allow(null)).optional(),
  dispenseId: Joi.string().uuid().required(),
  medicineDispensedList: Joi.array().min(1).items(prescribedMedicineSchema).required()
});

// OTC dispense block
const otcDispenseSchema = Joi.object({
  generatedOn: Joi.string().isoDate().required(),
  patientId: Joi.string().required(),
  note: Joi.alternatives().try(Joi.string(), Joi.allow(null)).optional(),
  dispenseId: Joi.string().uuid().required(),
  medicineDispensedList: Joi.array().min(1).items(otcMedicineSchema).required()
});

// Unified schema (prescribed or OTC)
const unifiedDispenseSchema = Joi.array().items(
  Joi.alternatives().try(prescribedDispenseSchema, otcDispenseSchema)
);

module.exports = {unifiedDispenseSchema}
