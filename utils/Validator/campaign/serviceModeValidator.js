const Joi = require("joi");

const serviceModeSchema = Joi.array().items(
    Joi.object({
        uuid: Joi.string().optional(),

        name: Joi.string()
            .trim()
            .min(2)
            .max(100)
            .required()
            .messages({
                "string.empty": "Name is required",
                "string.min": "Name must be at least 2 characters",
                "string.max": "Name cannot exceed 100 characters"
            }),

        description: Joi.string()
            .allow("")
            .max(500)
            .optional(),

        status: Joi.string()
            .valid("ACTIVE", "INACTIVE")
            .required()
    })
);

const serviceModeUpdateSchema = Joi.array().items(
    Joi.object({
        id: Joi.number()
            .required()
            .messages({
                "any.required": "ID is required for update"
            }),

        status: Joi.string()
            .valid("ACTIVE", "INACTIVE")
            .required()
    })
);


module.exports = { serviceModeUpdateSchema, serviceModeSchema };