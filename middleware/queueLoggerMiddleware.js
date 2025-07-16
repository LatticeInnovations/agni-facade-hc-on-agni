const { sendToQueue, connectRabbitMQ } = require("../config/rabbitMQ");
const queues = {
    "patients": "AGNI_TO_HEARTCARE_MAIN"
}

function queueLoggerMiddleware(req, res, next) {
    const originalJson = res.json;
    console.info("req: ", req.queueMeta, req.body, req.url, req.method)
    console.log("----------------------------------------------------")
    console.log("req.headers: ", req.headers)
    const isSyncOrigin = req.headers['x-sync-origin'] === 'true'; // Normalize check

    res.json = async function (body){
        console.log("body: ", body)
        try {
            if(!isSyncOrigin && req.queueMeta && Array.isArray(req.body) && body.status && body?.status == 1) {
                console.log("Entered here ")
                const channel = await connectRabbitMQ();
                const queueName = queues[req.queueMeta.entity];
                console.log("channel: ", channel, "queue name: ", queueName)
                if(!channel || !queueName || queueName != "AGNI_TO_HEARTCARE_MAIN") {
                    console.error("Queue or channel not available. Skipping queue logging.");
                    return originalJson.call(this, body);
                }
                for(let i = 0; i < req.body.length; i++) {
                    const patientResultData = body?.data.find(e => e.id === req?.body[i].id || e.fhirId === req?.body[i].fhirId)
                    console.log("check patient data here: ", patientResultData, req?.body[i].id, body.data)
                    const status = patientResultData?.status

                    const queueData = {
                        data: req?.body[i],
                        entity: req.queueMeta.entity,
                        requestType: req.queueMeta.requestType,
                        reqUrl: req.baseUrl,
                        apiName: req.queueMeta.apiName,
                        decodedToken: req.decoded,
                        result: {
                            "status": status,
                            "message": body?.message,
                            "data": patientResultData
                        }
                    }
                    await sendToQueue(queues[req.queueMeta.entity], queueData);
                    console.info(`✔️ Queued [${req.queueMeta.entity}] item ${queueData}`);
                }

            }
        }
        catch (e) {
            console.error("Queue logging failed:", e, e.message);      
        }

    return originalJson.call(this, body);
  };

  next();
}


module.exports = queueLoggerMiddleware;