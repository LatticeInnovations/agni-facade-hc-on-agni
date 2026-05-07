const { sendToQueue } = require("../config/rabbitMQ");

async function publishReportJob(patientId, fhirIds) {

  await sendToQueue("SCREENING_REPORT_QUEUE", {
    patientId,
    fhirIds,
    createdAt: new Date().toISOString()
  });

}

module.exports = { publishReportJob };