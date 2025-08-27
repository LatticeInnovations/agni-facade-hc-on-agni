const Joi = require('joi');

const examinationSchema = Joi.array().items(
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

    examinations: Joi.array()
      .items(Joi.string().pattern(/^\d+$/).optional())
      .min(0)
      .required()
  })
);


const examinationUpdateSchema = Joi.array().items(
  Joi.object({
    fhirId: Joi.string()
      .optional(),

    appointmentId: Joi.string()
      .pattern(/^\d+$/)
      .required(),

    patientId: Joi.string()
      .pattern(/^\d+$/)
      .required(),

    appUpdatedDate: Joi.string()
      .isoDate()
      .required(),

    examinations: Joi.array()
      .items(Joi.string().pattern(/^\d+$/).optional())
      .min(0)
      .required()
  })
);

module.exports = {examinationSchema, examinationUpdateSchema}
