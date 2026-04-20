const axios = require("axios");
const config = require("../../config/nodeConfig");
const { getToken } = require("./tokenStore");

const fhirClient = axios.create({
  baseURL: config.baseUrl,
  timeout: 30000
});

/**
 * Request Interceptor
 * Adds Authorization header automatically
 */
fhirClient.interceptors.request.use(async (request) => {

  const token = await getToken();

  if (token) {
    request.headers.Authorization = `Bearer ${token}`;
  }
  else {
    request.headers.Authorization = `Bearer ${config.token}`;
  }

  request.headers["Content-Type"] = "application/fhir+json";

  return request;

});

/**
 * Response Interceptor
 * Handles expired tokens
 */
fhirClient.interceptors.response.use(

  (response) => response,

  async (error) => {

    if (error.response?.status === 401) {

      console.log("FHIR token expired or invalid");

    }

    return Promise.reject(error);

  }

);

module.exports = fhirClient;