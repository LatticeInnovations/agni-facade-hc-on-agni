const fs = require('fs');
const amqp = require('amqplib');

const QUEUE_NAME = 'HEARTCARE_ADMIN_TO_AGNI';
const FILE_PATH = './medication-master-prod.json'; // path to your JSON file
const BRAND_NAME_FILE_PATH = './medication_brands-prod.json';
const BRAND_MAPPING_FILE_PATH = './medication_brand_mapping_prod.json';
const INTERVAL_MS = 10 * 1000; // 10 seconds

(async () => {
    try {
        // Read all data
        const records = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));

        const brandNames = JSON.parse(fs.readFileSync(BRAND_NAME_FILE_PATH, 'utf8'));
        const brandMapping = JSON.parse(fs.readFileSync(BRAND_MAPPING_FILE_PATH, 'utf8'));
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
            const brandIds = brandMapping
                .filter(bm => bm.medication_id === rec.medication_id)
                .map(bm => bm.brand_name_id);
            const brandNameList = brandNames
                .filter(bn => brandIds.includes(bn.medication_brand_id))
                .map(bn => bn.name);
            // Transform into required format
            const message = {
                data: {
                    categoryId: rec.medication_category_id,
                    classId: rec.medication_class_id,
                    code: rec.code,
                    name: rec.primary_name,
                    secondaryName: rec.secondary_name,
                    dosage: rec.dosage,
                    quantityPerDosage: rec.quantity_per_dosage,
                    dosesPerDay: rec.doses_per_day,
                    duration: rec.duration,
                    comment: rec.comments,
                    brandNames: brandNameList
                },
                entity: 'medicines',
                apiName: 'add-medicine',
                requestType: 'post',
                reqUrl: "/Medication",
                decodedToken: {
                    userTypeId: 1,
                    userPrimaryId: 1,
                    userId: 'User01',
                    fhirId: '2'
                },
                result: {
                    medicationId: rec.medication_id,
                    message: 'Updates medication record'
                },
                source_backend: 'HEARTCARE_ADMIN',
                target_backend: 'AGNI'
            };

            // channel.sendToQueue(
            //     QUEUE_NAME,
            //     Buffer.from(JSON.stringify(message)),
            //     { persistent: true }
            // );
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