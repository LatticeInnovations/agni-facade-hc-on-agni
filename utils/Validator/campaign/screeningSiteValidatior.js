const Joi = require("joi");

const SERVICE_MODES = ["OUTREACH", "COMMUNITY", "CLINIC"];
const LOCATION_TYPES = ["FREE_TEXT", "AREA_COUNCIL"];

const screeningSiteSchema = Joi.object({
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

    serviceMode: Joi.string()
        .trim()
        .required()
        .messages({
            "string.empty": "Service mode is required"
        }),

    startDate: Joi.date()
        .min("now")
        .required()
        .messages({
            "date.min": "Start date must be today or future"
        }),

    endDate: Joi.date()
        .min(Joi.ref("startDate"))
        .required()
        .messages({
            "date.min": "End date must be after start date"
        }),

    location: Joi.object({
        type: Joi.string()
            .valid(...LOCATION_TYPES)
            .required(),

        value: Joi.string().trim().required()
    }).required(),

    staffIds: Joi.array()
        .min(1)
        .max(10)
        .items(
            Joi.object({
                id: Joi.string().required(),

                isHead: Joi.boolean().required()
            })
        )
        .required()
        .messages({
            "array.min": "At least one staff required",
            "array.max": "Maximum 10 staff allowed"
        })
});

module.exports = { screeningSiteSchema };