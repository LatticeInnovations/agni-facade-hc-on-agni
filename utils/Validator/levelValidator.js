const Joi = require('joi');

const locationSchema = Joi.object({
  uuid: Joi.string()
    .guid({ version: 'uuidv4' })
    .required(),

  code: Joi.string()
    .required(),

  name: Joi.string()
    .required(),

  population: Joi.number()
    .integer().allow(null),

  secondaryName: Joi.string()
    .allow(null),


  levelType: Joi.string()
    .valid('province', 'area-council', 'island', 'health-facility', 'village')
    .required(),

    precedingLevelId: Joi.alternatives().conditional('levelType', {
        is: 'province',
        then: Joi.valid(null).required(),
        otherwise: Joi.number()
          .required()
      })
});

// For an array of locations:
const levelSaveSchema = Joi.array().items(locationSchema);
const levelPatchSchema = Joi.array().items(locationSchema);


module.exports = {levelSaveSchema, levelPatchSchema}