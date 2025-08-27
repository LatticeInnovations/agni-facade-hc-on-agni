const Joi = require('joi');

const allergySchema = Joi.array().items(
  Joi.object({
    allergy: Joi.string().allow(null), 
    appointmentId: Joi.string().required(),
    patientId: Joi.string().required(),
    uuid: Joi.string().required(),
    appUpdatedDate: Joi.string().isoDate().required()
  })
);

module.exports = {allergySchema};