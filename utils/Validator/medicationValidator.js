const Joi = require('joi');

const medicineSaveSchema = Joi.array().items(
  Joi.object({
    uuid: Joi.string().guid({ version: 'uuidv4' }).required(),
    code: Joi.string().required(),
    name: Joi.string().required(),
    classId: Joi.number().required(),
    className: Joi.string().required(),
    categoryId: Joi.number().required(),
    categoryName: Joi.string().required(),
    dosage: Joi.number().required(),
    brandList: Joi.array().required().items(
      Joi.object({
        id: Joi.number().required(),
        name: Joi.string().required()
      })
    )
  })
);

const medicineUpdateSchema = Joi.array().items(
    Joi.object({
      fhirId: Joi.string().required(),
      uuid: Joi.string().guid({ version: 'uuidv4' }).required(),
      code: Joi.string().required(),
      name: Joi.string().required(),
      classId: Joi.number().required(),
      className: Joi.string().required(),
      categoryId: Joi.number().required(),
      categoryName: Joi.string().required(),
      dosage: Joi.number().required(),
      brandList: Joi.array().required().items(
        Joi.object({
          id: Joi.number().required(),
          name: Joi.string().required()
        })
      )
    })
  );

  const medicinePatchSchema = Joi.array().items(
    Joi.object({
      fhirId: Joi.string().required(),
      status: Joi.string().valid("active", "inactive").required()
  }))

module.exports = {medicineSaveSchema, medicineUpdateSchema, medicinePatchSchema}