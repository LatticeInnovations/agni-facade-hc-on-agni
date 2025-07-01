const Joi = require("joi");


const fileSchema = Joi.object({
  'filename': Joi.string().min(1).max(40).required()
})

const immunizationSaveObject = Joi.object({
  immunizationUuid: Joi.string()
    .min(30)
    .max(100)
    .required(),
  patientId: Joi.string().required(),
  appointmentId: Joi.string().required(),
  lotNumber: Joi.string().required(),
  expiryDate: Joi.date().required(),
  createdOn: Joi.date().required(),
  manufacturerId: Joi.string().allow(null).optional(),
  notes: Joi.string().allow(null).optional(),
  vaccineCode: Joi.string().valid('19', '45', '2', '10', '20', '17', '133', '122', '88', '3', '190', '84', '21', '115', '62').required(),
  immunizationFiles: Joi.array().items(fileSchema).optional()
});

module.exports = { immunizationSaveObject }