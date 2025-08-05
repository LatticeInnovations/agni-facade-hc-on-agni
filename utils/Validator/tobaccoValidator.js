const Joi = require('joi');

const tobaccoSchema = Joi.array().items(
  Joi.object({
    appointmentId: Joi.string().required(),
    patientId: Joi.string().required(),
    uuid: Joi.string().uuid().required(),
    appUpdatedDate: Joi.date().iso().required(),

    tobaccoUse: Joi.number()
      .valid(1, 2, 3)
      .required(),

    // briefAdvice shown only when tobaccoUse is 1 or 2
    briefAdvice: Joi.boolean().when('tobaccoUse', {
      is: Joi.valid(1, 2),
      then: Joi.required(),
      otherwise: Joi.optional().allow(null)
    }),

    // assessedStatus shown only if briefAdvice is true
    assessedStatus: Joi.boolean().when('briefAdvice', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional().allow(null)
    }),

    // assistQuit shown only if assessedStatus is true
    assistQuit: Joi.number().valid(1, 2, 3, 4).when('assessedStatus', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional().allow(null)
    }),

    // pharmacotherapy shown only if assistQuit == 2
    pharmacotherapy: Joi.number().valid(1, 2, 3).when('assistQuit', {
      is: 2,
      then: Joi.required(),
      otherwise: Joi.optional().allow(null)
    }),

    // dateOfPlan required if assistQuit == 1 or 2
    dateOfPlan: Joi.date().iso().when('assistQuit', {
      is: Joi.valid(1, 2),
      then: Joi.required(),
      otherwise: Joi.optional().allow(null)
    }),

    // planStatus required if assistQuit == 1 or 2
    planStatus: Joi.number().valid(1, 2, 3).when('assistQuit', {
      is: Joi.valid(1, 2),
      then: Joi.required(),
      otherwise: Joi.optional().allow(null)
    })
  })
);


module.exports = {tobaccoSchema}