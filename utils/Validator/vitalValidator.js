const Joi = require("joi");

const conditionalField = (unitValues = [], typeValues = []) =>
  Joi.object({
    value: Joi.alternatives([
      Joi.number(),
      Joi.valid(null)
    ]),
    type: typeValues.length > 0
      ? Joi.alternatives().conditional('value', {
          is: Joi.exist().not(null),
          then: Joi.string().valid(...typeValues).required(),
          otherwise: Joi.string().valid(...typeValues).allow('', null)
        })
      : Joi.forbidden(),
    unit: Joi.alternatives().conditional('value', {
      is: Joi.exist().not(null),
      then: Joi.string().valid(...unitValues).required(),
      otherwise: Joi.string().valid(...unitValues).allow('', null)
    })
  }).allow(null);

const vitalSchema = Joi.object({
    appointmentId: Joi.string().required(),
    patientId: Joi.string().required(),
    uuid: Joi.string().guid({ version: ['uuidv4'] }).required(),
    appUpdatedDate: Joi.date().iso().required(),

    bloodGlucose: conditionalField(["mg/dL", "mmol/L"], ["fasting", "random"]),
    serumCreatinine: conditionalField(["mg/dL"]),
    abdominalCircumference: conditionalField(["in", "cm"]),
    hipCircumference: conditionalField(["in", "cm"]),
    serumPotassium: conditionalField(["mEq/L"]),

    hbA1cPercentage: Joi.alternatives([Joi.number(), Joi.valid(null)]),
    urineProtein: Joi.string().allow('', null),
    urineKetones: Joi.string().allow('', null),
    eyeExamination: Joi.string().allow('', null),
    footExamination: Joi.string().allow('', null),
    others: Joi.string().allow('', null)
  })


// Schema for an array of vital entries
const vitalSaveSchema = Joi.array().items(vitalSchema);

module.exports = {vitalSaveSchema}