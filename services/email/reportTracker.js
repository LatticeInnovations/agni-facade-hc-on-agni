const axios = require("axios");
let config = require("../../config/nodeConfig");
const base = config.baseUrl;
let fhirClient = require("./fhirAxiosClient");

async function getLastReport(patientId) {

  const res = await fhirClient.get(
    `${base}Communication?subject=Patient/${patientId}&category=screening-report`
  );

  if (!res.data.entry) return null;

  const latest = res.data.entry.sort(
    (a, b) =>
      new Date(b.resource.sent) -
      new Date(a.resource.sent)
  )[0];

  return latest?.resource?.sent || null;

}

async function saveReportSent(patientId) {

  await fhirClient.post(
    `${base}Communication`,
    {
      resourceType: "Communication",
      status: "completed",
      category: [{ text: "screening-report" }],
      subject: {
        reference: `Patient/${patientId}`
      },
      sent: new Date().toISOString()
    }
  );

}

module.exports = { getLastReport, saveReportSent };