const cron = require("node-cron");
const redis = require("redis");

const { generateReport } = require("../email/reportService");

const redisClient = redis.createClient();

async function processPendingReports() {

  await redisClient.connect();

  const patients = await redisClient.sMembers("pending_reports");

  console.log("Pending patients:", patients);

  for (const patientId of patients) {

    try {

      await generateReport(patientId);

    } catch (err) {

      console.error("Report generation failed", err);

    }

  }

  await redisClient.del("pending_reports");

}

function reportTrigger() {

  cron.schedule(
    "0 9,12,15,18,21 * * *",
    async () => {

      console.log("Running report window");

      await processPendingReports();

    },
    { timezone: "Pacific/Efate" }
  );

  console.log("Report scheduler started");

}

module.exports = { reportTrigger };