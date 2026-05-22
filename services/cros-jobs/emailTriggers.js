const cron = require("node-cron");
const redis = require("redis");
const  { client }  = require('../../services/redisConnect');
const { generateReport } = require("../email/reportService");

let isRunning = false;

async function processPendingReports() {

  if (isRunning) {
    console.log("Previous report cycle still running");
    return;
  }

  isRunning = true;

  try {

    const patients = await client.sMembers("pending_reports");

    console.log("Pending patients:", patients);

    for (const patientId of patients) {

      try {

        const key = `pending_reports:${patientId}`;
        const fhirIds = await client.sMembers(key);

        console.log(`Processing ${patientId}`, fhirIds);

        await generateReport(patientId, fhirIds);

        await client.del(key);
        await client.sRem("pending_reports", patientId);

      } catch (err) {

        console.error(
          `Report generation failed for ${patientId}`,
          err.message
        );

      }
    }

  } finally {
    isRunning = false;
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