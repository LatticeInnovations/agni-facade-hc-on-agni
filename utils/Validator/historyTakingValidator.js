const Joi = require('joi');

const historyTakingSchema = Joi.array().items(
  Joi.object({
    medicinePrescribed: Joi.array()
    .items(Joi.string())
    .required()
    .min(0),

    medicinePrescribedOthers: Joi.alternatives().conditional('medicinePrescribed', {
      is: Joi.array().items(Joi.valid('74964007')).has('74964007'),
      then: Joi.string().trim().required(),
      otherwise: Joi.string().trim().allow(null),
    }),

    adherence: Joi.string().valid("1", "2", "3", "4").allow(null), // assuming 0, 1, 2 are valid values

    hasSideEffect: Joi.boolean().required(),

    sideEffects: Joi.alternatives().conditional('hasSideEffect', {
      is: true,
      then: Joi.string().trim().required(),
      otherwise: Joi.valid(null),
    }),

    appointmentId: Joi.string().required(),
    patientId: Joi.string().required(),
    uuid: Joi.string().guid({ version: 'uuidv4' }).required(),
    appUpdatedDate: Joi.string().isoDate().required()
  })
);

module.exports = {historyTakingSchema};