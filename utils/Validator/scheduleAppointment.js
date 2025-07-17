const Joi = require("joi");


const scheduleValidation = Joi.object({
    uuid: Joi.string()
      .min(30)
      .max(100)
      .required(),
    planningHorizon: Joi.object({
      start: Joi.date().required(),
      end: Joi.date().greater(Joi.ref("start")).required()
    }).required(),
    orgId: Joi.string().optional()
  })

let scheduleSaveSchema = Joi.array().items(scheduleValidation).min(1).required()

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
    orgId: Joi.string().optional(),
    appointmentType: Joi.string().valid('walkin', 'routine').required(),
    generatedOn: Joi.date()
  });

  const appointmentSaveSchema = Joi.array().items(appointmentSchema).min(1).required()



  let apptPatchSchema = Joi.object({
    "patientId": Joi.string().required(),
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
  
  let appointmentPatchSchema = Joi.array().items(apptPatchSchema).min(1).required()



module.exports = { scheduleSaveSchema, appointmentSaveSchema, appointmentPatchSchema }