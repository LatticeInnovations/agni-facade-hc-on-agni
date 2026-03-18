require("dotenv").config();

const amqp = require("amqplib");
const redis = require("redis");

const redisClient = redis.createClient();

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

      channel.ack(msg);

    } catch (err) {

      console.error("Worker error", err);

      channel.nack(msg, false, true);

    }

  });

}

startWorker();