const axios = require("axios");
const config = require("../../config/nodeConfig");
const { getToken } = require("./tokenStore");
const { client: redisClient } = require("../redisConnect");

const fhirClient = axios.create({
  baseURL: config.baseUrl,
  timeout: 30000
});
let refreshPromise = null;
async function login() {

  const response = await axios.post(
    `${config.heartcareUrl}/login`,
    {
      userId: config.heartcareUsername,
      password: config.heartcarePassword
    }
  );

  const token =
    response.headers.authorization?.replace("Bearer ", "");

  const refreshToken =
    response.headers.refreshtoken;

  await redisClient.set("FHIR_TOKEN", token, {
    EX: 3600
  });

  await redisClient.set(
    "FHIR_REFRESH_TOKEN",
    refreshToken,
    { EX: 86400 }
  );

  return token;
}
async function getFreshToken() {
  if (!refreshPromise) {
    refreshPromise = login().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}
fhirClient.interceptors.request.use(async (request) => {
  let token = null;
  try {
    token = await getToken();
  } catch (err) {
    console.warn("Redis token fetch failed, using env token:", err.message);
  }

  if (token) {
    request.headers.Authorization = `Bearer ${token}`;
  }

  request.headers["Content-Type"] = "application/fhir+json";
  return request;
});

fhirClient.interceptors.response.use(
  (response) => response,

  async (error) => {

    const originalRequest = error.config || {};

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {

      originalRequest._retry = true;

      try {

        console.log("Refreshing token...");

        const newToken = await getFreshToken();

        originalRequest.headers.Authorization =
          `Bearer ${newToken}`;
        console.log("FHIR token refreshed successfully");
        return fhirClient(originalRequest);

      } catch (refreshErr) {

        console.error(
          "Token regeneration failed",
          refreshErr.message
        );

        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);

module.exports = fhirClient;