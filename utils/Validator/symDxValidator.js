const Joi = require("joi");

// Schema for a single symptom-diagnosis object
const symDiagSchema = Joi.object({
  appointmentId: Joi.number().required(),
  symDiagUuid: Joi.string().uuid().required(),
  createdOn: Joi.string().isoDate().required(),
  symptoms: Joi.array().items(Joi.string()).required(),
  diagnosis: Joi.array().items(Joi.string()).required()
});

// Schema for the array
const symDiagSaveArraySchema = Joi.array().items(symDiagSchema);

const symDiagPatchSchema = Joi.object({
    symDiagFhirId: Joi.string().required(),
    createdOn: Joi.string().isoDate().required(),
    symptoms: Joi.array().items(Joi.string()).required(),     // Can be empty []
    diagnosis: Joi.array().items(Joi.string()).required()     // Can be empty []
  });

const symDiagPatchArraySchema = Joi.array().items(symDiagPatchSchema);


module.exports = {symDiagSaveArraySchema, symDiagPatchArraySchema}
