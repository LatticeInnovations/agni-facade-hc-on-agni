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

async function buildAndSendReport(entries, patientId, encounterIds, forceType, email, preBuiltReport, locationName = null) {
  const { report, fileName, appointmentId, encounterId, dob } = preBuiltReport;
  const template = fs.readFileSync(templatePath, "utf8");
  
  const html = template.replace(/\$\{data\.(.*?)\}/g, (match, key) => {
    const value = key.trim().split('.').reduce((obj, k) => obj?.[k], report);
    return value ?? "--";
  });
  const htmlWithLogo = html.replace("LOGO_PLACEHOLDER", `data:image/png;base64,${logoBase64}`);
  const pdfBuffer = await generatePdf(htmlWithLogo);

  await savePdfToUploads(pdfBuffer, fileName);

  const [/*reportToken*/, created] = await ReportToken.findOrCreate({
  where: { appointmentId },
  defaults: {
      token: uuidv4(),
      patientId,
      dob,
      fileName,
      reportType: report.reportType,
    }
  });

  if (created) await saveDocumentReference(patientId, encounterId, fileName);

  if (!email) {
    console.log("Patient has no email");
    return;
  }

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
      <p>Thank you for participating in our HeartCare community screening program.${locationName ? ` Your screening was conducted at <strong>${locationName}</strong>.` : ''} Your screening results from ${report.visitDate} are attached.</p>
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

async function fetchWithRetry(patientId, maxRetries = 3, delayMs = 2000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`Fetching data (attempt ${attempt}/${maxRetries})...`);
    const entries = await fetchEverything(patientId);
    const observations = entries.filter(e => e.resource?.resourceType === "Observation");
    const encounters = entries.filter(e => e.resource?.resourceType === "Encounter");
    
    if (observations.length > 0 || encounters.length > 0) {
      console.log(`Data found: ${observations.length} observations, ${encounters.length} encounters`);
      return entries;
    }
    
    if (attempt < maxRetries) {
      console.log(`No data found, retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  return await fetchEverything(patientId);
}

function groupEncountersByLocation(encounters) {
  const locationGroups = new Map();
  
  encounters.forEach(enc => {
    const resource = enc.resource || enc;
    if (resource.type && resource.type[0] && resource.type[0].coding && 
        resource.type[0].coding.some(c => c.code && c.code.includes("screening-site"))) {
      const locationRef = resource.location && resource.location[0] && resource.location[0].location && resource.location[0].location.reference;
      if (locationRef) {
        if (!locationGroups.has(locationRef)) {
          locationGroups.set(locationRef, []);
        }
        locationGroups.get(locationRef).push(resource.id);
      }
    }
  });
  
  return locationGroups;
}

function getLocationName(entries, locationRef) {
  const locationEntry = entries.find(e => 
    e.fullUrl?.includes(`/Location/`) && 
    e.resource?.id === locationRef?.split("/")[1]
  );
  return locationEntry?.resource?.name || null;
}

async function generateReport(patientId, encounterIds) {
  const entries = await fetchWithRetry(patientId);
  const email = extractEmail(entries);

  const lastSent = await getLastReport(patientId);
  const latestUpdate = await fetchResourceTimestamp(entries);

  if (lastSent && latestUpdate <= new Date(lastSent).getTime()) {
    console.log("No new updates");
    return;
  }

  const report = buildReport(entries, encounterIds);

  const hasScreening = report.hasScreening;
  const hasFacility = report.hasFacility;

  if (!hasScreening && !hasFacility) {
    console.log("No valid encounter data found");
    return;
  }

  const encounters = entries.filter(e => e.resource?.resourceType === "Encounter");
  
  if (hasScreening) {
    const encounters = entries.filter(e => e.resource?.resourceType === "Encounter");
    const locationGroups = groupEncountersByLocation(encounters);
    console.log(`Found ${locationGroups.size} unique screening locations`);
    console.log(`Location groups:`, [...locationGroups.keys()]);
    
    for (const [locationRef, locationEncounterIds] of locationGroups) {
      const locationName = getLocationName(entries, locationRef);
      console.log(`Generating report for location: ${locationRef} (${locationName || 'Unknown'})`);
      
      const locationEncounters = encounters.filter(e => {
        const ref = e.location && e.location[0] && e.location[0].location && e.location[0].location.reference;
        return ref === locationRef;
      });
      const screeningReport = buildReport(entries, locationEncounterIds, "screening-site");
      
      if (screeningReport.hasData) {
        await buildAndSendReport(entries, patientId, locationEncounterIds, "screening-site", email, screeningReport, locationName);
        console.log(`Email sent for location: ${locationRef} (${locationName || 'Unknown'})`);
      }
    }
  }

  if (hasFacility) {
    const facilityReport = buildReport(entries, encounterIds, "facility");
    console.log("Generating facility report...");
    await buildAndSendReport(entries, patientId, encounterIds, "facility", email, facilityReport);
  }

  await saveReportSent(patientId);
}

module.exports = { generateReport };