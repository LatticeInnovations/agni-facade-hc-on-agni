const Joi = require("joi");


const loginSchema = Joi.object({
    userContact: Joi.alternatives().try(
      Joi.string().email(),
      Joi.string().pattern(/^[6-9]\d{9}$/)
    ).required()
  });

const otpSchema = Joi.object({
    userContact: Joi.alternatives().try(
      Joi.string().email(),
      Joi.string().pattern(/^[6-9]\d{9}$/)
    ).required(),
  
    otp: Joi.number().integer().min(100000).max(999999).required()
  });


  module.exports = {loginSchema, otpSchema}