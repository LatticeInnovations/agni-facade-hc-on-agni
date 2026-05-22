const  { client }  = require("../redisConnect");

const TOKEN_KEY = "FHIR_TOKEN";

async function getToken() {
  return await client.get(TOKEN_KEY);
}

async function saveToken(token) {
  await client.set(TOKEN_KEY, token, {
    EX: 3600
  });
}

module.exports = {
  getToken,
  saveToken
};