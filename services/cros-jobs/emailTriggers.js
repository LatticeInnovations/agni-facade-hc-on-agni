const cron = require("node-cron");
const redis = require("redis");

const { generateReport } = require("../email/reportService");

const redisClient = redis.createClient();

async function initRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
    console.log("Redis connected");
  }
}

async function processPendingReports() {

  const patients = await redisClient.sMembers("pending_reports");

  console.log("Pending patients:", patients);

  for (const patientId of patients) {

    try {

      const key = `pending_reports:${patientId}`;
      const fhirIds = await redisClient.sMembers(key);

      console.log(`Processing ${patientId}`, fhirIds);

      await generateReport(patientId, fhirIds);

      // cleanup after success
      await redisClient.del(key);
      await redisClient.sRem("pending_reports", patientId);

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

initRedis().catch(err => {
  console.error("Redis connection failed", err);
});

module.exports = { reportTrigger };