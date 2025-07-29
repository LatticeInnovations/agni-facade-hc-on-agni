const Joi = require('joi');

const allergySchema = Joi.array().items(
  Joi.object({
    allergy: Joi.string().allow(null), 
    appointmentId: Joi.string().required(),
    patientId: Joi.string().required(),
    uuid: Joi.string().guid({ version: 'uuidv4' }).required(),
    appUpdatedDate: Joi.string().isoDate().required()
  })
);

module.exports = {allergySchema};