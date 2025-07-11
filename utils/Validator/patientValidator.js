const Joi = require("joi");


// Define schema for a single object
const patientSchema = Joi.object({
  id: Joi.string().uuid().required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  middleName: Joi.string().allow(null, '').optional(),

  identifier: Joi.array().items(
    Joi.object({
      identifierType: Joi.string().uri().required(),
      identifierNumber: Joi.string().required(),
      code: Joi.string().allow(null).optional(),
      use: Joi.string().allow(null).optional()
    })
  ).optional(),
  appUpdatedDate: Joi.string().optional(),
  gender: Joi.string().valid("male", "female", "other").required(),
  active: Joi.boolean().required(),
  birthDate: Joi.string().isoDate().required(), // Ensures YYYY-MM-DD format

  permanentAddress: Joi.object({
    addressLine1: Joi.string().optional(),
    addressLine2: Joi.string().allow(null).optional(),
    district: Joi.string().optional(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    postalCode: Joi.string().optional().allow(null, ""),
    country: Joi.string().required()
  }).required(),

  mobileNumber: Joi.string().pattern(/^[0-9]{10,15}$/).optional().allow(null, ""),
  mothersName: Joi.string().allow(null).required(),
  fathersName: Joi.string().allow(null).optional(),
  spouseName: Joi.string().allow(null).optional(),
  patientDeceasedReasonId: Joi.number().allow(null).optional(),
  patientDeceasedReason: Joi.string().allow(null).optional(),
  email: Joi.string().email().optional(),
  heartcareId: Joi.string().optional().allow(null, "")
});

// Define allowed operations
const operationEnum = Joi.string().valid("add", "replace", "remove").required();

// Patch field structure
const patchField = (valueSchema) =>
  Joi.object({
    operation: operationEnum,
    value: valueSchema.when("operation", {
      is: Joi.string().valid("replace", "add"),
      then: Joi.required(),
      otherwise: Joi.forbidden()
    }),
    "deletedReason": Joi.string().optional()
  });

// Address schema used inside permanentAddress
const addressSchema = Joi.object({
  addressLine1: Joi.string().optional(),
  addressLine2: Joi.string().optional(),
  district: Joi.string().optional(),
  city: Joi.string(),
  state: Joi.string(),
  postalCode: Joi.string(),
  country: Joi.string()
});

// Main PATCH schema for Patient
const patientPatchObject = Joi.object({
  fhirId: Joi.number().required(),
  id: Joi.string().optional(),

  // firstName: patchField(Joi.string()).optional(),
  // middleName: patchField(Joi.string().allow(null, '')).optional(),
  // lastName: patchField(Joi.string()).optional(),

  // gender: patchField(Joi.string().valid("male", "female", "other", "unknown")).optional(),
  
  active: patchField(Joi.boolean()).optional(),
  // birthDate: patchField(Joi.string().isoDate()).optional(),

  // permanentAddress: patchField(addressSchema).optional(),

  // email: patchField(Joi.string().email()).optional(),
  mobileNumber: patchField(Joi.string().pattern(/^[0-9]{10}$/)).optional().allow(null, ""),
  heartcareId: patchField(Joi.string().optional())
});

// Array of practitioners
const patientSaveSchema = Joi.array().items(patientSchema)
.min(1) // 👈 ensures array is not empty
.required();

const patientPatchSchema = Joi.array().items(patientPatchObject)
.min(1) // 👈 ensures array is not empty
.required();




module.exports = {patientSaveSchema, patientPatchSchema}