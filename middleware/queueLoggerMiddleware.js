const { sendToQueue, connectRabbitMQ } = require("../config/rabbitMQ");
const {getChannel} = require("../config/rabbitMQ")
const queues = {
    "patient": "AGNI_TO_HEARTCARE_MAIN"
}

function queueLoggerMiddleware(req, res, next) {
    const originalJson = res.json;
    console.info("req: ", req.queueMeta, req.body, req.url, req.method)
    console.log("----------------------------------------------------")
   
    res.json = async function (body){
        console.log("body: ", body)
        try {
            if(req.queueMeta && Array.isArray(req.body)) {
                console.log("Entered here ")
                const channel = await connectRabbitMQ();
                const queueName = queues[req.queueMeta.entity];
                if(!channel || !queueName) {
                    console.error("Queue or channel not available. Skipping queue logging.");
                    return originalJson.call(this, body);
                }
                for(let i = 0; i < req.body.length; i++) {
                    const result = body?.data[i] || {}
                    const status = body?.status

                    const queueData = {
                        data: req?.body[i],
                        entity: req.queueMeta.entity,
                        requestType: req.queueMeta.requestType,
                        result: {
                            "status": status,
                            "message": body?.message,
                            "data": result
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