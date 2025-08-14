const Joi = require('joi');

// Tobacco Item Types: 10 options, including 'Other' as 10
const tobaccoItemTypes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const riskFactorSchema = Joi.array().items(
  Joi.object({
    appointmentId: Joi.string().required(),
    patientId: Joi.string().required(),
    uuid: Joi.string().guid().required(),
    appUpdatedDate: Joi.date().iso().required(),

    tobacco: Joi.object({
      tobaccoUser: Joi.boolean().allow(null),

      tobaccoItemType: Joi.number()
        .valid(...tobaccoItemTypes)
        .when('tobaccoUser', { is: true, then: Joi.required() })
        .allow(null),

      tobaccoOther: Joi.string()
        .when('tobaccoItemType', {
          is: 10, // Assuming 10 is the 'Other' option
          then: Joi.string().min(1).required(),
          otherwise: Joi.string().optional().allow(null)
        }),

      consumptionAmount: Joi.number()
        .positive()
        .when('tobaccoUser', { is: true, then: Joi.required(), otherwise: Joi.number().allow(null) }),
        

      consumptionUnit: Joi.string()
        .valid('Times', 'Sticks')
        .when('tobaccoUser', { is: true, then: Joi.required(), otherwise: Joi.string().allow(null) }),
        

      startAge: Joi.number()
        .min(1)
        .max(120)
        .when('tobaccoUser', { is: true, then: Joi.required(), otherwise: Joi.number().allow(null)}),

      willingToQuit: Joi.boolean().when('tobaccoUser', { is: true, then: Joi.required(), otherwise: Joi.boolean().allow(null) })
    .allow(null)
      }).allow(null),

    alcohol: Joi.object({
      consumedWithin30Days: Joi.boolean().allow(null),

      alcoholQ1: Joi.number().when('consumedWithin30Days', {
        is: true,
        then: Joi.required(),
        
      })
      .allow(null),

      alcoholQ2: Joi.number().when('consumedWithin30Days', {
        is: true,
        then: Joi.required(),
        otherwise: Joi.number().allow(null)
      }),

      alcoholQ3: Joi.number().when('consumedWithin30Days', {
        is: true,
        then: Joi.required(),
        otherwise: Joi.number().allow(null)
      })
    }).optional()
    .allow(null),

    fruitsVegetables: Joi.object({
      consumptionInWeek: Joi.boolean().allow(null),

      fruitsDays: Joi.number().when('consumptionInWeek', {
        is: true,
        then: Joi.required()
      }).allow(null),

      fruitServings: Joi.number().when('consumptionInWeek', {
        is: true,
        then: Joi.required(),
        otherwise: Joi.number().allow(null)

      }),

      vegetableDays: Joi.number().when('consumptionInWeek', {
        is: true,
        then: Joi.required(),
        otherwise: Joi.number().allow(null)
      }),

      vegetableServings: Joi.number().when('consumptionInWeek', {
        is: true,
        then: Joi.required(),
        otherwise: Joi.number().allow(null)
      })
    }).optional()
    .allow(null),

    physicalActivity: Joi.object({
      weeklyEngagement: Joi.boolean().allow(null),

      vigorousDays: Joi.number().when('weeklyEngagement', {
        is: true,
        then: Joi.required(),
        otherwise: Joi.number().allow(null)
      }),

      vigorousTime: Joi.number().min(1).max(1440).when('weeklyEngagement', {
        is: true,
        then: Joi.required(),
        otherwise: Joi.number().allow(null)
      }),

      moderateDays: Joi.number().when('weeklyEngagement', {
        is: true,
        then: Joi.required(),
        otherwise: Joi.number().allow(null),
      }),

      moderateTime: Joi.number().min(1).max(1440).when('weeklyEngagement', {
        is: true,
        then: Joi.required(),
        otherwise: Joi.number().allow(null)
      })
    }).optional()
    .allow(null),

    salt: Joi.object({
      saltAmount: Joi.number().valid(1, 2, 3, 4, 5, 6).optional().allow(null),
      saltAddMeal: Joi.number().valid(1, 2, 3, 4, 5, 6).optional().allow(null),
      saltAddCooking: Joi.number().valid(1, 2, 3, 4, 5, 6).optional().allow(null),
      saltProcessedFood: Joi.number().valid(1, 2, 3, 4, 5, 6).optional().allow(null)
    }).optional()
    .allow(null),

    fatAndOil: Joi.object({
      oilUsed: Joi.number().valid(1, 2, 3, 4, 5, 6, 7).optional().allow(null),
      fatFoodFrequency: Joi.number().optional().valid(1, 2, 3, 4, 5, 6, 7).allow(null),
      otherFatAndOils: Joi.string().when('oilUsed', {
        is: 5, // Assuming 5 means "Other"
        then: Joi.string().min(1).required(),
        otherwise: Joi.string().optional().allow(null)
      })
    }).optional()
    .allow(null),

    sugar: Joi.object({
      softDrinkFrequency: Joi.number().valid(1, 2, 3, 4, 5, 6, 7).optional().allow(null),
      juiceFrequency: Joi.number().valid(1, 2, 3, 4, 5, 6, 7).optional().allow(null)
    }).optional().allow(null),

    mealsOutsideHome: Joi.object({
      eatsOut: Joi.boolean().allow(null),

      mealsPerWeek: Joi.number()
        .when('eatsOut', {
          is: true,
          then: Joi.optional()
        }).allow(null)
    }).optional().allow(null),

    riskFactors: Joi.array().items(Joi.string()),
  })
);

module.exports = {riskFactorSchema}