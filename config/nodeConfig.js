require('dotenv').config();
let config = function () {
             return {
            port: '3000',
            timeout: 120000,
            version: process.env.version,
            baseUrl: process.env.FHIRServerBaseURL,
            twilioNumber: process.env.twilioNumber,
            sendgridKey: process.env.sendgridKey,
            jwtSecretKey: process.env.jwtSecretKey,
            totalLoginAttempts: 5,
            lockTimeInMin: 5,
            OTPExpireMin: 2,
            OTPGenAttempt: 5,
            OTPHash: process.env.OTPHash,
            schemaList: process.env.schemaList,
            domainsList: process.env.domainsList,
            whitelist: process.env.whitelist,
            sctCodeUrl: process.env.sctCodeUrl,
            prescriptionUrl: process.env.prescriptionUrl,
            measureUrl: process.env.measureUrl,
            snUrl : process.env.snUrl,
            orgType : process.env.orgType,
            fhirCodeUrl : process.env.fhirCodeUrl,
            roleCodeUrl : process.env.roleCodeUrl,
            facadeUrl : process.env.facadeUrl,
            mailgunApiKey: process.env.MAILGUN_API_KEY,
            mailgunDomain: process.env.MAILGUN_DOMAIN,
            mailFrom: process.env.MAIL_FROM,
            token: process.env.token,
            crvsBaseUrl: process.env.crvsBaseUrl,
            crvsUsername: process.env.crvsUsername,
            crvsPassword: process.env.crvsPassword
        };
};
module.exports = new config();