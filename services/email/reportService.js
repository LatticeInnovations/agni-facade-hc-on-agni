const { fetchEverything } = require("./fhirService");
const { extractEmail } = require("./emailExtractor");
const { buildReport } = require("./reportBuilder");
const { sendEmail } = require("../../utils/mailgun.util");
const { getLastReport, saveReportSent, saveDocumentReference } = require("./reportTracker");
const { generatePdf, savePdfToUploads } = require("../templates/pdfGenerator");
const path = require("path");
const fs = require("fs");
const { ReportToken } = require("../../models");
const { v4: uuidv4 } = require("uuid");

const templatePath = path.join(__dirname, "../templates/heartcareReport.html");
const logoPath = path.join(__dirname, "../../utils/logo/heartcare_new_512.png");
const logoBase64 = fs.readFileSync(logoPath).toString("base64");

const RESOURCE_TYPES = Object.freeze([
  "Patient", "Observation", "Condition", "Encounter", 
  "QuestionnaireResponse", "Questionnaire", "ServiceRequest", "MedicationRequest"
]);

async function fetchResourceTimestamp(entries) {
  return Math.max(...entries
    .filter(e => RESOURCE_TYPES.includes(e.resource?.resourceType))
    .map(e => new Date(e.resource.meta.lastUpdated).getTime())
  );
}

async function buildAndSendReport(entries, patientId, encounterIds, forceType, email) {
  const { report, fileName, filePassword, appointmentId, encounterId, dob } = buildReport(entries, encounterIds, forceType);
  const template = fs.readFileSync(templatePath, "utf8");

  const html = template.replace(/\$\{data\.(.*?)\}/g, (match, key) => {
    const value = key.split('.').reduce((obj, k) => obj?.[k], report);
    return value ?? "--";
  });
  const htmlWithLogo = html.replace("LOGO_PLACEHOLDER", `data:image/png;base64,${logoBase64}`);
  const pdfBuffer = await generatePdf(htmlWithLogo);
  await savePdfToUploads(pdfBuffer, fileName, filePassword);

  const [/*reportToken*/, created] = await ReportToken.findOrCreate({
    where: { appointmentId },
    defaults: { token: uuidv4(), patientId, dob, fileName }
  });

  if (created) await saveDocumentReference(patientId, encounterId, fileName);

  const reportType = report.reportType || "general";
  let typeLabel;
  switch (reportType) {
    case "screening-site":
      typeLabel = "Screening";
      break;
    case "facility":
      typeLabel = "Facility";
      break;
    default:
      typeLabel = "Health";
  }
  
  const contentMap = {
    "screening-site": `
      <p>Dear ${report.name},</p>
      <p>Thank you for participating in our HeartCare community screening program. Your screening results from ${report.visitDate} are attached.</p>
      <p>This screening helps identify potential risk factors. Based on your results, you may be referred to a health facility for further evaluation if needed.</p>
      <p>Please review the attached report and contact us if you have any questions.</p>
      <p>Wishing you good health,<br>HeartCare Team</p>`,
    "facility": `
      <p>Dear ${report.name},</p>
      <p>Please find your detailed HeartCare facility report from your visit on ${report.visitDate}${report.facility ? ` at ${report.facility}` : ""}.</p>
      <p>This report includes your clinical assessment, medications, and follow-up recommendations.</p>
      <p>Please keep this for your records and attend any scheduled follow-up appointments.</p>
      <p>Warm regards,<br>HeartCare Team</p>`
  };
  
  const content = contentMap[reportType] || contentMap["facility"];
  const subject = `HeartCare ${typeLabel} Report - ${report.name} (${report.visitDate})`;

  await sendEmail({
    to: email,
    subject: subject,
    content: content,
    attachments: [{ filename: "heartcare-report.pdf", data: pdfBuffer, contentType: "application/pdf" }]
  });

  return { fileName, report };
}

async function generateReport(patientId, encounterIds) {
  const entries = await fetchEverything(patientId);
  const email = extractEmail(entries);
  
  console.log("Fetching FHIR data for patient", patientId);
  console.log("Email extracted:", email);

  const lastSent = await getLastReport(patientId);
  const latestUpdate = await fetchResourceTimestamp(entries);

  if (lastSent && latestUpdate <= new Date(lastSent).getTime()) {
    console.log("No new updates");
    return;
  }

  if (!email) {
    console.log("Patient has no email");
    return;
  }

  const screeningReport = buildReport(entries, encounterIds, "screening-site");
  const facilityReport = buildReport(entries, encounterIds, "facility");

  const hasScreening = screeningReport.report?.visitDate !== "--" && screeningReport.report?.visitDate;
  const hasFacility = facilityReport.report?.visitDate !== "--" && facilityReport.report?.visitDate;

  if (hasScreening) {
    console.log("Generating screening-site report...");
    await buildAndSendReport(entries, patientId, encounterIds, "screening-site", email);
  }

  if (hasFacility) {
    console.log("Generating facility report...");
    await buildAndSendReport(entries, patientId, encounterIds, "facility", email);
  }

  await saveReportSent(patientId);
}

module.exports = { generateReport };