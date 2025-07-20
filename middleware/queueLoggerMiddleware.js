'use strict';

const { sendToQueue, connectRabbitMQ } = require("../config/rabbitMQ");

const queues = {
  "patients": "AGNI_TO_HEARTCARE_MAIN",
  "appointments": "AGNI_TO_HEARTCARE_MAIN"
};

// Maps entity name to the key that should be used as `fhirId`
const entityFhirIdMap = {
  appointments: "appointmentId",
};

// Function to find the matching response object from body.data
function findMatchingResponse(responseData, item) {
  return responseData.find(e =>
    (e.id && e.id === item.id) ||(item.uuid && e.id && e.id === item.uuid) ||
    (e.fhirId && e.fhirId === item.fhirId)
  );
}

// Condition handler map
const conditionHandlers = {
  appointments: (item, req, resultData) => {
    console.log(item, req.queueMeta.requestType)
    if (req.queueMeta.requestType === "put" && !["scheduled", "walkin", "cancelled"].includes(item.status?.value)) {
      return { skip: true };
    }

    if (item.status && item.status.value === "cancelled") {
      return {
        skip: false,
        override: {
          requestType: "delete",
          apiName: "delete-appointment",
        },
      };
    }

    return { skip: false };
  },
  // risks: (item, req, resultData) => { ... },
  // Add more entity-specific handlers here
};

function queueLoggerMiddleware(req, res, next) {
  const originalJson = res.json;

  console.info("req: ", req.queueMeta, req.body, req.url, req.method);
  console.log("----------------------------------------------------");
  console.log("req.headers: ", req.headers);

  const isSyncOrigin = req.headers['x-sync-origin'] === 'true';

  res.json = async function (body) {
    console.log("response body: ", body);
    try {
      if ( !isSyncOrigin &&  req.queueMeta &&  Array.isArray(req.body) && body?.status === 1) {
        console.log("✔️ Queue logging activated");

        const channel = await connectRabbitMQ();
        const queueName = queues[req.queueMeta.entity];
        console.log("queueName: ", queueName)
        if (!channel || !queueName || queueName !== "AGNI_TO_HEARTCARE_MAIN") {
          console.error("Queue or channel not available. Skipping queue logging.");
          return originalJson.call(this, body);
        }

        for (let i = 0; i < req.body.length; i++) {
          const item = req.body[i];

          // Auto-map fhirId if entityFhirIdMap entry exists
          const fhirIdKey = entityFhirIdMap[req.queueMeta.entity];
          if (fhirIdKey && item[fhirIdKey]) {
            item.fhirId = item[fhirIdKey];
          }

          const dataResult = findMatchingResponse(body?.data || [], item);
          console.log("dataResult: ", dataResult)
          if (!dataResult) {
            console.warn("No matching response for item:", item);
            continue;
          }
          const status = dataResult?.status;
          // Handle entity-specific logic (e.g., override requestType)
          const handler = conditionHandlers[req.queueMeta.entity];
          if (handler) {
            const dataResponse = handler(item, req, dataResult);
            if (dataResponse?.skip) {
              console.log("dataResponse: ", dataResponse)
              console.warn("! data match not found in appointment skipped")
              continue;
            }
            if (dataResponse?.override) {
              req.queueMeta = { ...req.queueMeta,  ...dataResponse.override, };
            }
          }

          const queueData = {
            data: item,
            entity: req.queueMeta.entity,
            requestType: req.queueMeta.requestType,
            reqUrl: req.baseUrl,
            apiName: req.queueMeta.apiName,
            decodedToken: req.decoded,
            result: {
              status,
              message: body?.[i]?.message || body?.message,
              data: dataResult,
            }
          };

          console.log("Sending to queue:", queueData);
          await sendToQueue(queueName, queueData);
          console.info(`✔️ Queued [${req.queueMeta.entity}] item successfully.`);
        }
      }
      else {
        console.log("data is not from sync details")
      }
    } catch (e) {
      console.error("Queue logging failed:", e.message, e);
    }

    return originalJson.call(this, body);
  };

  next();
}

module.exports = queueLoggerMiddleware;
