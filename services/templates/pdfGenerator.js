const puppeteer = require("puppeteer");
const fs = require('fs');
const path = require('path');

const { exec } = require("child_process");

async function generatePdf(html) {

const browser = await puppeteer.launch({
headless: true,
args: [
"--no-sandbox",
"--disable-setuid-sandbox",
"--disable-dev-shm-usage",
"--disable-gpu"
],
timeout: 0
});

const page = await browser.newPage();

await page.setContent(html, {
  waitUntil: "load",
  timeout: 0 
});

const pdf = await page.pdf({
format: "A4",
printBackground: true
});

await browser.close();

return pdf;

}

async function savePdfToUploads(pdfBuffer, fileName, password) {
  try {
    const uploadsDir = path.join(process.cwd(), "uploads");

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const tempPath = path.join(uploadsDir, `temp-${fileName}`);
    const finalPath = path.join(uploadsDir, fileName);

    // Save temp PDF
    await fs.promises.writeFile(tempPath, pdfBuffer);

    // Encrypt using qpdf
    const command = `qpdf --encrypt "${password}" "${password}" 256 -- "${tempPath}" "${finalPath}"`;

    await new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) return reject(error);
        resolve();
      });
    });

    // Remove temp file
    fs.unlinkSync(tempPath);

    console.log(`Protected PDF saved at: ${finalPath}`);
    return finalPath;

  } catch (error) {
    console.error("Error saving PDF:", error);
    throw error;
  }
}

module.exports = { generatePdf, savePdfToUploads };