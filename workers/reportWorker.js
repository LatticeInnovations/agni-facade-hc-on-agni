require("dotenv").config();

const amqp = require("amqplib");
const redis = require("redis");
const { getToken } = require("../services/email/tokenStore");

const redisClient = redis.createClient();
const config = require("../config/nodeConfig");
const base = config.baseUrl;

async function findMainEncounterId(fhirIds, patientId) {
  if (!fhirIds || !fhirIds.length) return fhirIds[0];

  const axios = require("axios");
  let token = null;
  try {
    token = await getToken();
  } catch (err) {
    console.warn("Redis token fetch failed:", err.message);
  }
  const authToken = token || config.token;
  const headers = { Authorization: `Bearer ${authToken}`, "Content-Type": "application/fhir+json" };

  const encounters = [];
  for (const id of fhirIds) {
    try {
      const res = await axios.get(`${base}Encounter/${id}`, { headers });
      encounters.push({ id, ...res.data });
    } catch (err) {
      continue;
    }
  }

  const screeningMain = encounters.find(e =>
    e.type?.[0]?.coding?.[0]?.code === "screening-site-main-encounter"
  );
  if (screeningMain) return screeningMain.id;

  const facilityMain = encounters.find(e =>
    e.type?.[0]?.coding?.[0]?.code === "facility-main-encounter" && !e.partOf
  );
  if (facilityMain) return facilityMain.id;

  const cvdEncounter = encounters.find(e =>
    e.type?.[0]?.coding?.[0]?.code?.includes("cvd-encounter")
  );
  if (cvdEncounter) {
    return cvdEncounter.partOf?.reference?.split("/")[1] || cvdEncounter.id;
  }

  const withPartOf = encounters.find(e => e.partOf);
  if (withPartOf) {
    return withPartOf.partOf.reference.split("/")[1];
  }

  return fhirIds[0];
}

async function startWorker() {

  await redisClient.connect();

  const connection = await amqp.connect(process.env.RABBITMQ_URL);

  const channel = await connection.createChannel();

  const queue = "SCREENING_REPORT_QUEUE";

  await channel.assertQueue(queue, { durable: true });

  console.log("Report worker started");

  channel.consume(queue, async (msg) => {
    if (!msg) return;

    const job = JSON.parse(msg.content.toString());
    console.log("Queue job received:", job);

    try {
      await redisClient.sAdd("pending_reports", job.patientId);

      await redisClient.sAdd(
        `pending_reports:${job.patientId}`,
        ...job.fhirIds
      );

      channel.ack(msg);
    } catch (err) {
      console.error("Worker error", err);
      channel.nack(msg, false, true);
    }
  });

}

startWorker();