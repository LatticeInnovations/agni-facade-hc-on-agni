const axios = require("axios");
const config = require("../../config/nodeConfig");
const { getToken } = require("./tokenStore");
const { client: redisClient } = require("../redisConnect");

const fhirClient = axios.create({
  baseURL: config.baseUrl,
  timeout: 30000
});

fhirClient.interceptors.request.use(async (request) => {
  let token = null;
  try {
    token = await getToken();
  } catch (err) {
    console.warn("Redis token fetch failed, using env token:", err.message);
  }

  if (token) {
    request.headers.Authorization = `Bearer ${token}`;
  } else {
    request.headers.Authorization = `Bearer ${config.token}`;
  }

  request.headers["Content-Type"] = "application/fhir+json";
  return request;
});

fhirClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      console.log("FHIR token expired or invalid, clearing Redis token");
      try {
        await redisClient.del("FHIR_TOKEN");
      } catch (e) {
        console.warn("Failed to clear expired token from Redis:", e.message);
      }
    }
    return Promise.reject(error);
  }
);

module.exports = fhirClient;