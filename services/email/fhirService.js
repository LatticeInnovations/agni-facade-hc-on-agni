const axios = require("axios");

let config = require("../../config/nodeConfig");
const base = config.baseUrl;
let fhirClient = require("./fhirAxiosClient");

function replaceBaseUrl(nextUrl, baseUrl) {
  const parsedNext = new URL(nextUrl);
  const parsedBase = new URL(baseUrl);

  // Replace protocol + host
  parsedNext.protocol = parsedBase.protocol;
  parsedNext.host = parsedBase.host;

  return parsedNext.toString();
}
async function fetchEverything(patientId) {
  let url = `${base}Patient/${patientId}/$everything?_count=200`;
  let allEntries = [];

  while (url) {
    const res = await fhirClient.get(url);
    const data = res.data;

    allEntries = allEntries.concat(data.entry || []);

    const nextLink = data.link?.find(l => l.relation === "next");
    url = nextLink?.url
      ? replaceBaseUrl(nextLink.url, base)
      : null;
  }

  return allEntries;
}

async function fetchPatient(patientId) {
  try {
    const res = await fhirClient.get(`${base}Patient/${patientId}`);
    return res.data;
  } catch (error) {
    console.error("Error fetching patient:", error.response?.data || error.message);
    throw error;
  }
}

module.exports = { fetchEverything, fetchPatient };