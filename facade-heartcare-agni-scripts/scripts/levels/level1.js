const fs = require('fs');
const amqp = require('amqplib');

const QUEUE_NAME = 'HEARTCARE_ADMIN_TO_AGNI';
const FILE_PATH = './level1-prod.json'; // path to your JSON file
const INTERVAL_MS = 20 * 1000; // 10 seconds

(async () => {
    try {
        // Read all data
        const records = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
        // Connect to RabbitMQ
        const connection = await amqp.connect('amqp://heartcareAdmin:heartcareAgni%40150725@10.252.0.94:5672'); // change if needed
        const channel = await connection.createChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: true });

        let index = 0;

        const pushNext = () => {
            if (index >= records.length) {
                console.log('✅ All records pushed to queue');
                connection.close();
                return;
            }

            const rec = records[index];
            // Transform into required format
            const message = {
                 data: {
                    code: rec.code,
                    name: rec.primary_name,
                    population: rec.population,
                    secondaryName: rec.secondary_name,
                    precedingLevelId: 0
                },
                entity: 'level',
                apiName: 'add-level',
                requestType: 'post',
                reqUrl: '/level/one',
                decodedToken: {
                    userTypeId: 1,
                    userPrimaryId: 1,
                    userId: 'User01',
                    fhirId: '2'
                },
                result: {
                    "Level Id": rec.level_1_id || null,
                    message: 'Level created successfully'
                },
                source_backend: 'HEARTCARE_ADMIN',
                target_backend: 'AGNI'
            };

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