const Joi = require("joi");

const schema = Joi.object({
    uuid: Joi.string().guid({ version: ['uuidv4', 'uuidv5'] }).required(),
    appointmentId: Joi.string().pattern(/^\d+$/).required(),
    patientId: Joi.string().pattern(/^\d+$/).required(),
    appUpdatedDate: Joi.date().iso().optional(),
  
    hasHypertension: Joi.boolean().required(),
    hasAsthma: Joi.boolean().required(),
    hasHeartDiseases: Joi.boolean().required(),
    hasChronicObstructivePulmonaryDisease: Joi.boolean().required(),
    hasTransientIschaemicAttack: Joi.boolean().required(),
    hasChronicKidneyDiseases: Joi.boolean().required(),
    hasDiabetes: Joi.boolean().required(),
    hasTuberculosis: Joi.boolean().required(),
    hasHypercholesterolaemia: Joi.boolean().required(),
    hasAids: Joi.boolean().required(),
    hasCancer: Joi.boolean().required(),
    hasOthers: Joi.boolean().required(),
    hasCovid: Joi.boolean().required(),
  
    cancer: Joi.string()
      .max(100)
      .when('hasCancer', {
        is: true,
        then: Joi.required(),
        otherwise: Joi.optional().allow("", null)
      }),
  
    others: Joi.string()
      .max(255)
      .when('hasOthers', {
        is: true,
        then: Joi.required(),
        otherwise: Joi.optional().allow("", null)
      })
  });

  

  // Schema for array of PATCH operations
  const priorDxArraySchema = Joi.array().items(schema);
  
  
  
  module.exports = {priorDxArraySchema}