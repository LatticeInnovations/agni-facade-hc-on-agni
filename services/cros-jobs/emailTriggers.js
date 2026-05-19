const cron = require("node-cron");
const redis = require("redis");
const  { client }  = require('../../services/redisConnect');
const { generateReport } = require("../email/reportService");

async function processPendingReports() {

  const patients = await client.sMembers("pending_reports");

  console.log("Pending patients:", patients);

  for (const patientId of patients) {

    try {

      const key = `pending_reports:${patientId}`;
      const fhirIds = await client.sMembers(key);

      console.log(`Processing ${patientId}`, fhirIds);

      await generateReport(patientId, fhirIds);

      // cleanup after success
      await client.del(key);
      await client.sRem("pending_reports", patientId);

    } catch (err) {

      console.error("Report generation failed", err);

    }

  }
}

function reportTrigger() {

  cron.schedule(
    "*  * * * *",
    async () => {

      console.log("Running report window");

      await processPendingReports();

    },
    { timezone: "Pacific/Efate" }
  );

  console.log("Report scheduler started");
}

module.exports = { reportTrigger };