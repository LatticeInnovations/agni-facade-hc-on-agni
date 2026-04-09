const { fetchEverything } = require("./fhirService");
const { extractEmail } = require("./emailExtractor");
const { buildReport } = require("./reportBuilder");
const { sendEmail } = require("../../utils/mailgun.util");
const { getLastReport, saveReportSent } = require("./reportTracker");
const { generatePdf, savePdfToUploads } = require("../templates/pdfGenerator");
const path = require("path");
const fs = require("fs");

const templatePath = path.join(
    __dirname,
    "../templates/heartcareReport.html"
);
const logoPath = path.join(__dirname, "../../utils/logo/heartcare_new_512.png");
const logoBase64 = fs.readFileSync(logoPath).toString("base64");
async function generateReport(patientId) {
    const entries = await fetchEverything(patientId);

    const email = extractEmail(entries);
    console.log("Fetching FHIR data for patient", patientId);
    console.log("Email extracted:", email);
    console.log("Generating report...");
    console.log("Sending email...");

    const lastSent = await getLastReport(patientId);

    const latestUpdate = Math.max(
        ...entries
            .filter(e =>
                ["Patient", "Observation", "Condition", "Encounter", "QuestionnaireResponse", "Questionnaire", "ServiceRequest", "MedicationRequest"].includes(
                    e.resource.resourceType
                )
            )
            .map(e =>
                new Date(e.resource.meta.lastUpdated).getTime()
            )
    );

    if (lastSent && latestUpdate <= new Date(lastSent).getTime()) {

        console.log("No new updates");

        return;

    }
    const { report, fileName }  = buildReport(entries);
    const template = fs.readFileSync(templatePath, "utf8");

    const html = template.replace(/\$\{data\.(.*?)\}/g, (match, key) => {

        const value = key.split('.').reduce((obj, k) => obj?.[k], report);

        return value ?? "--";

    });
    const htmlWithLogo = html.replace(
        "LOGO_PLACEHOLDER",
        `data:image/png;base64,${logoBase64}`
    );
    const pdfBuffer = await generatePdf(htmlWithLogo);

    await savePdfToUploads(pdfBuffer, fileName);

    if (!email) {
        console.log("Patient has no email");
        return;
    }
    
    const subject = `HeartCare Screening Report - ${report.name} (${report.visitDate})`;

    const content = `
        <p>Dear ${report.name},</p>

        <p>
        We are pleased to share your HeartCare screening report conducted on ${report.visitDate}${
        report.facility ? ` at ${report.facility}` : ""
        }.
        </p>

        <p>
        Please find the detailed report attached for your reference.
        </p>

        <p>Wishing you good health.</p>

        <p>
        Warm regards,<br>
        HeartCare Team
        </p>
        `;
    await sendEmail({
        to: email,
        subject: subject,
        content: content,
        attachments: [{
            filename: "heartcare-report.pdf",
            data: pdfBuffer,
            contentType: "application/pdf"
        }]
    });

    await saveReportSent(patientId);

}

module.exports = { generateReport };