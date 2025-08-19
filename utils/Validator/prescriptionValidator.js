const Joi = require("joi");

// Prescription item schema
const prescriptionItemSchema = Joi.object({
  medFhirId: Joi.string().required(),
  medReqUuid: Joi.string().uuid().required(),
  qtyPerDose: Joi.number().required(),
  frequency: Joi.number().required(),
  doseForm: Joi.string().required(),
  timing: Joi.string().required(),
  duration: Joi.number().required(),
  qtyPrescribed: Joi.number().required(),
  note: Joi.string().allow(null).optional(),
  brandName: Joi.string().allow(null).optional()
});

// Prescription block schema
const prescriptionBlockSchema = Joi.object({
  appointmentId: Joi.string().required(),
  patientId: Joi.string().required(),
  generatedOn: Joi.string().isoDate().required(), // Accepts ISO timestamp with timezone
  appUpdatedOn: Joi.string().isoDate().required(),
  prescriptionId: Joi.string().uuid().required(),
  prescription: Joi.array().min(1).items(prescriptionItemSchema).required()
});

// Full array schema
const prescriptionArraySchema = Joi.array().min(1).items(prescriptionBlockSchema);

const deletePrescriptionSchema = Joi.array().items(Joi.number().integer().positive()).min(1);


// Schema for individual prescription file
const prescriptionFileSchema = Joi.object({
  documentUuid: Joi.string().uuid().required(),
  filename: Joi.string().required(),
  note: Joi.alternatives().try(Joi.string(), Joi.allow(null)).optional()
});

// Schema for the full prescription object
const prescriptionRecordSchema = Joi.object({
  appointmentId: Joi.string().required(),
  patientId: Joi.string().required(),
  generatedOn: Joi.string().isoDate().required(),
  prescriptionId: Joi.string().uuid().required(),
  prescriptionFiles: Joi.array().items(prescriptionFileSchema).min(1).required()
});

const prescriptionUpdateRecordSchema =  Joi.object({
  appointmentId: Joi.string().required(),
  patientId: Joi.string().required(),
  generatedOn: Joi.string().isoDate().required(), // Accepts ISO timestamp with timezone
  appUpdatedOn: Joi.string().isoDate().required(),
  prescriptionFhirId: Joi.string().required(),
  prescription: Joi.array().min(1).items(prescriptionItemSchema).required()
});

const prescriptionUpdateSchema = Joi.array().min(1).items(prescriptionUpdateRecordSchema);


// Final schema for the array of prescriptions
const prescriptionFileArraySchema = Joi.array().min(1).items(prescriptionRecordSchema);



module.exports = {prescriptionArraySchema, prescriptionFileArraySchema, deletePrescriptionSchema, prescriptionUpdateSchema}
