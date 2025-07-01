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

// Address schema
const addressSchema = Joi.object({
  addressLine1: Joi.string().required(),
  district: Joi.alternatives().try(Joi.string(), Joi.allow(null)).optional(),
  city: Joi.string().required(),
  state: Joi.string().required(),
  postalCode: Joi.string().required(),
  country: Joi.string().required()
});

// Practitioner object schema
const practitionerSchema = Joi.object({
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  identifier: identifierSchema.optional(),
  gender: Joi.string().valid("male", "female", "other").required(),
  active: Joi.boolean().required(),
  birthDate: Joi.string().isoDate().required(),
  address: addressSchema.required(),
  email: Joi.alternatives().try(Joi.string().email(), Joi.allow(null)).optional(),
  mobileNumber: Joi.string().required()
});

// Array of practitioners
const practitionerSaveArraySchema = Joi.array().items(practitionerSchema)
.min(1) // 👈 ensures array is not empty
.required();

module.exports = {practitionerSaveArraySchema}