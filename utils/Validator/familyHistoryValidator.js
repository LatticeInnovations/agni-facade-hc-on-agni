const Joi = require('joi');

const familyHistorySchema = Joi.array().items(
  Joi.object({
    familyDiseases: Joi.array().items(Joi.string()).required().min(0),
    occurrenceAgeData: Joi.string().valid("yes", "no").allow(null), 
    appointmentId: Joi.string().required(),
    patientId: Joi.string().required(),
    uuid: Joi.string().guid({ version: 'uuidv4' }).required(),
    appUpdatedDate: Joi.string().isoDate().required()
  })
);

module.exports = {familyHistorySchema};