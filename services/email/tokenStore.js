const redis = require("redis");

const client = redis.createClient({
  socket: {
    host: "127.0.0.1",
    port: 6379
  }
});

client.on("error", (err) => {
  console.error("Redis error:", err);
});

(async () => {
  if (!client.isOpen) {
    await client.connect();
    console.log("Redis connected");
  }
})();

async function getToken() {
  return await client.get("FHIR_TOKEN");
}

async function saveToken(token) {
  await client.set("FHIR_TOKEN", token, {
    EX: 3600
  });
}

module.exports = {
  getToken,
  saveToken
};