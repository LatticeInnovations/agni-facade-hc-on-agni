const { sendToQueue } = require("../config/rabbitMQ");

async function publishReportJob(patientId, appointmentDate) {

  await sendToQueue("SCREENING_REPORT_QUEUE", {
    patientId,
    createdAt: new Date().toISOString()
  });

}

module.exports = { publishReportJob };