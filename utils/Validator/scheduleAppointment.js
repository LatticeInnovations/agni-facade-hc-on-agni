const Joi = require("joi");

function validateScheduleArray(userInput) {
  let JoiSchema = Joi.array().items(scheduleValidation).min(1).required()
  return JoiSchema.validate(userInput);
}

const scheduleValidation = Joi.object({
    uuid: Joi.string()
      .min(30)
      .max(100)
      .required(),
    planningHorizon: Joi.object({
      start: Joi.date().required(),
      end: Joi.date().greater(Joi.ref("start")).required()
    }).required(),
    orgId: Joi.string().required()
  })

function validateAppointmentArray(userInput) {
  let JoiSchema = Joi.array().items(appointmentSchema).min(1).required()
  return JoiSchema.validate(userInput);
}


  let appointmentSchema = Joi.object({
    uuid: Joi.string()
      .min(30)
      .max(100)
      .required(),
    slot: Joi.object({
      start: Joi.date().required(),
      end: Joi.date().greater(Joi.ref("start")).required()
    }).required(),
    createdOn: Joi.date().required(),
    status: Joi.string().valid('arrived', 'walkin', 'scheduled', 'noshow', 'cancelled', 'in-progress', 'completed').required(),
    patientId: Joi.string().required(),
    scheduleId: Joi.string().required(),
    orgId: Joi.string().required(),
    appointmentType: Joi.string().valid('walkin', 'routine').required(),
    generatedOn: Joi.date()
  });

  function validateAppointmentPatch(userInput) {
    let JoiSchema = Joi.array().items(apptPatchSchema).min(1).required()
    return JoiSchema.validate(userInput);
  }

  let apptPatchSchema = Joi.object({
    "appointmentId": Joi.string().required(),
    "generatedOn": Joi.date().optional(),
    status: Joi.object({
      "operation": Joi.string().valid('replace').required(),
      "value": Joi.string().valid('arrived', 'scheduled', 'noshow', 'cancelled', 'in-progress', 'completed').required()
    }).required() ,
    slot: Joi.object({
      "operation": Joi.string().valid('replace').required(),
      "value": Joi.object({
        start: Joi.date().required(),
        end: Joi.date().greater(Joi.ref("start")).required()
      }) }).when('status.value', { is: "scheduled", then: Joi.required(), otherwise: Joi.optional() }),
    createdOn: Joi.object({
      "operation": Joi.string().valid('replace').required(),
      "value":Joi.date().required()
    }).when('status.value', { is: "scheduled", then: Joi.required(), otherwise: Joi.optional() }),
    scheduleId: Joi.object({
      "operation": Joi.string().valid('replace').required(),
      "value": Joi.string().required()
    }).when('status.value', { is: "scheduled", then: Joi.required(), otherwise: Joi.optional() })
  });


module.exports = { validateScheduleArray, validateAppointmentArray, validateAppointmentPatch }