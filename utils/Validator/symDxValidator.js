const Joi = require("joi");

// Schema for a single symptom-diagnosis object
const symDiagSchema = Joi.object({
  appointmentId: Joi.number().required(),
  patientId: Joi.number().required(),
  uuid: Joi.string().uuid().required(),
  appUpdatedDate: Joi.string().isoDate().required(),
  diagnosis: Joi.array().items(Joi.string()).required(),
  progressNote: Joi.string().optional().allow(null)
});

// Schema for the array
const symDiagSaveArraySchema = Joi.array().items(symDiagSchema);

const symDiagPatchSchema = Joi.object({
    symDiagFhirId: Joi.string().required(),
    createdOn: Joi.string().isoDate().required(),  
    diagnosis: Joi.array().items(Joi.string()).required()     // Can be empty []
  });

const symDiagPatchArraySchema = Joi.array().items(symDiagPatchSchema);


module.exports = {symDiagSaveArraySchema, symDiagPatchArraySchema}
