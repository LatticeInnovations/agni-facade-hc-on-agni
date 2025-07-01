const Joi = require("joi");

// File object schema
const fileSchema = Joi.object({
  labDocumentUuid: Joi.string().uuid().required(),
  filename: Joi.string().required(),
  note: Joi.alternatives().try(Joi.string(), Joi.allow(null)).optional()
});

// Lab report object schema
const labReportSchema = Joi.object({
  diagnosticUuid: Joi.string().uuid().required(),
  appointmentId: Joi.string().required(),
  patientId: Joi.string().required(),
  createdOn: Joi.string().isoDate().required(),
  files: Joi.array().items(fileSchema).min(1).required()
});

// Final array schema
const labReportArraySchema = Joi.array().items(labReportSchema);

module.exports = {labReportArraySchema}