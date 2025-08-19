const Joi = require('joi');

const interventionSchema = Joi.array().items(
  Joi.object({
    uuid: Joi.string()
      .uuid({ version: 'uuidv4' })
      .required(),

    appointmentId: Joi.string()
      .pattern(/^\d+$/)
      .required(),

    patientId: Joi.string()
      .pattern(/^\d+$/)
      .required(),

    appUpdatedDate: Joi.string()
      .isoDate()
      .required(),

    interventions: Joi.array()
      .items(Joi.string().pattern(/^\d+$/).required())
      .min(1)
      .required()
  })
);

const interventionUpdateSchema = Joi.array().items(
  Joi.object({
    fhirId: Joi.string()
      .required(),

    appointmentId: Joi.string()
      .pattern(/^\d+$/)
      .required(),

    patientId: Joi.string()
      .pattern(/^\d+$/)
      .required(),

    appUpdatedDate: Joi.string()
      .isoDate()
      .required(),

    interventions: Joi.array()
      .items(Joi.string().pattern(/^\d+$/).required())
      .min(1)
      .required()
  })
);

module.exports = {interventionSchema, interventionUpdateSchema}
