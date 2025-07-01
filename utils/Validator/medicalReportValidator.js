const Joi = require("joi");

// File schema for individual documents
const medicalFileSchema = Joi.object({
  medicalDocumentUuid: Joi.string().uuid().required(),
  filename: Joi.string().required(),
  note: Joi.alternatives().try(Joi.string(), Joi.allow(null)).optional()
});

// Medical report object schema
const medicalReportSchema = Joi.object({
  medicalReportUuid: Joi.string().uuid().required(),
  appointmentId: Joi.string().required(),
  patientId: Joi.string().required(),
  createdOn: Joi.string().isoDate().required(),
  files: Joi.array().items(medicalFileSchema).min(1).required()
});

// Array of medical reports
const medicalReportArraySchema = Joi.array().min(1).items(medicalReportSchema);

module.exports = {medicalReportArraySchema}
