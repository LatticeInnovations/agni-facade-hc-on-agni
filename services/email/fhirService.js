const axios = require("axios");

let config = require("../../config/nodeConfig");
const base = config.baseUrl;
let fhirClient = require("./fhirAxiosClient");

async function fetchEverything(patientId) {
  let url = `${base}Patient/${patientId}/$everything?_count=200`;
  let allEntries = [];

  while (url) {
    const res = await fhirClient.get(url);
    const data = res.data;

    allEntries = allEntries.concat(data.entry || []);

    const nextLink = data.link?.find(l => l.relation === "next");
    url = nextLink ? nextLink.url : null;
  }

  return allEntries;
}

module.exports = { fetchEverything };