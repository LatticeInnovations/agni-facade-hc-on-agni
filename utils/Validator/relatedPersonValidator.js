const Joi = require("joi");

// Define relationship object schema
const relationshipSchema = Joi.object({
  relativeId: Joi.string().required(),
  patientIs: Joi.string().required() // You can restrict to allowed values like SIS, BRO, MOM, etc., if needed
});

// Define main person schema
const personWithRelationshipSchema = Joi.object({
  id: Joi.string().required(),
  relationship: Joi.array().items(relationshipSchema).required()
});

// Schema for the full array
const relatedPersonSaveSchema = Joi.array().items(personWithRelationshipSchema);

// Schema for the 'value' object inside 'relationship'
const relationshipValueSchema = Joi.object({
  relativeId: Joi.string().required(),
  patientIs: Joi.string().required() // Add .valid(...) if patientIs has restricted values
});

// Schema for each relationship patch operation
const relationshipPatchSchema = Joi.object({
  operation: Joi.string().valid("add", "replace", "remove").required(),
  value: relationshipValueSchema.required()
});

// Schema for each person entry
const patchPersonSchema = Joi.object({
  id: Joi.string().required(),
  relationship: Joi.array().items(relationshipPatchSchema).required()
});

// Schema for the array of patch operations
const relatedPersonPatchSchema = Joi.array().items(patchPersonSchema);



module.exports ={relatedPersonSaveSchema, relatedPersonPatchSchema}