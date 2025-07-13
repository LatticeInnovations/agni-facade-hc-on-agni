const Joi = require("joi");

// Identifier item schema
const identifierItemSchema = Joi.object({
  identifierType: Joi.string().uri().required(),
  identifierNumber: Joi.string().required()
});

// Identifier array schema: can be null, empty [], or valid array with required fields
const identifierSchema = Joi.alternatives().try(
  Joi.array().items(identifierItemSchema),
  Joi.valid(null)
);



// Practitioner object schema
const practitionerSchema = Joi.object({
  userId: Joi.string().required(),
  heartcareId: Joi.number().required(),
  firstName: Joi.string().required(),
  middleName: Joi.string().optional().allow(null, ""),
  lastName: Joi.string().required(),
  identifier: identifierSchema.optional(),
  active: Joi.boolean().required(),
  email: Joi.alternatives().try(Joi.string().email(), Joi.allow(null)).optional(),
  role: Joi.string().required(),
  mobileNumber: Joi.string().required(),
  healthFacilityCode: Joi.string().allow(null, "").optional()
});

// Array of practitioners
const practitionerSaveArraySchema = Joi.array().items(practitionerSchema)
.min(1) // 👈 ensures array is not empty
.required();

module.exports = {practitionerSaveArraySchema}