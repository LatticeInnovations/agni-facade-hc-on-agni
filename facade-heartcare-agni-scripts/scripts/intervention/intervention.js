const fs = require('fs');
const amqp = require('amqplib');

const QUEUE_NAME = 'HEARTCARE_ADMIN_TO_AGNI';
const FILE_PATH = './intervention-prod.json'; // path to your JSON file
const BRAND_NAME_FILE_PATH = './medicine_brand.json';
const BRAND_MAPPING_FILE_PATH = './medicine_brand_mapping.json';
const INTERVAL_MS = 30 * 1000; // 10 seconds

(async () => {
    try {
        // Read all data
        const records = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
        // Connect to RabbitMQ
        const connection = await amqp.connect('amqp://heartcareAdmin:HeartCareAgni150725@139.59.85.203:5672'); // change if needed
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
                    secondaryName: rec.secondary_name,
                    status: rec.is_active == "Y" ? "active" : "inactive"
                },
                entity: 'interventionMaster',
                apiName: 'save-intervention',
                requestType: 'post',
                reqUrl: "/intervention/master",
                decodedToken: {
                    userTypeId: 1,
                    userPrimaryId: 1,
                    userId: 'User01',
                    fhirId: '2'
                },
                result: {
                    interventionId: rec.intervention_id,
                    message: 'Create intervention record'
                },
                source_backend: 'HEARTCARE_ADMIN',
                target_backend: 'AGNI'
            };

            channel.sendToQueue(
                QUEUE_NAME,
                Buffer.from(JSON.stringify(message)),
                { persistent: true }
            );

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