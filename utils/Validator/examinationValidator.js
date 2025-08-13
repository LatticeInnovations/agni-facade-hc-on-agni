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
      .items(Joi.string().pattern(/^\d+$/).required())
      .min(1)
      .required()
  })
);

module.exports = {examinationSchema}
