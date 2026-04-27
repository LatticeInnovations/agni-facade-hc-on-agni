const fs = require('fs');
const amqp = require('amqplib');

const QUEUE_NAME = 'HEARTCARE_ADMIN_TO_AGNI';
const FILE_PATH = './users-prod.json'; // path to your JSON file

const INTERVAL_MS = 30 * 1000; // 10 seconds

(async () => {
    try {
        // Read all data
        const records = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
        // Connect to RabbitMQ
        const connection = await amqp.connect('amqp://guest:guest@localhost:5672'); // change if needed
        const channel = await connection.createChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: true });

        let index = 0;

        const pushNext = () => {
            if (index >= records.length) {
                console.log('✅ All records pushed to queue');
                // connection.close();
                return;
            }

            const rec = records[index];
            // Transform into required format
            const message = rec;

            channel.sendToQueue(
                QUEUE_NAME,
                Buffer.from(JSON.stringify(message)),
                { persistent: true }
            );
            console.log("message: ", message)
            console.log(`➡️ Pushed record", ${index + 1}/${records.length}, to queue`);
            index++;

            // Schedule next push
            setTimeout(pushNext, INTERVAL_MS);
        };

        pushNext();
    } catch (err) {
        console.error('❌ Error:', err);
    }
})();