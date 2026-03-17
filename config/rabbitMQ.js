const amqp = require("amqplib");
let channel = null;

async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL || "amqp://localhost");
    channel = await connection.createChannel();

    const queueNames = [
      "AGNI_TO_HEARTCARE_MAIN",
      "SCREENING_REPORT_QUEUE"
    ];

    for (const queue of queueNames) {
      await channel.assertQueue(queue, { durable: true }); // Durable
    }

    console.log("Backend 1 connected to RabbitMQ");
    return channel;
  } catch (err) {
    console.error("RabbitMQ connection failed in Backend 1", err);
  }
}

function getChannel() {
  return channel;
}

async function sendToQueue(queueName, message) {
    const ch = await connectRabbitMQ();
    if (!ch) {
      console.error("Queue or channel not available. Skipping queue logging.");
      return;
    }
  
    try {
        const success = ch.sendToQueue(
            queueName, Buffer.from(JSON.stringify(message), {persistent: true})
        )

        if(success) {
            console.log(`Message ${message} sent to queue: ${queueName}`)
        }
        else {
            console.error(`Message ${message} buffering in queue: ${queueName}`)
        }
    }
    catch(err){
        console.error("Unable to send to queue: ", err)
        throw err;
    }
}

module.exports = { connectRabbitMQ, getChannel, sendToQueue };