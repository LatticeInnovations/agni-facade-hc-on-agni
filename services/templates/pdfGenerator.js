const puppeteer = require("puppeteer");
const fs = require('fs');
const path = require('path');

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

async function savePdfToUploads(pdfBuffer, fileName) {
  try {
    const uploadsDir = path.join(process.cwd(), "uploads");

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const finalPath = path.join(uploadsDir, fileName);

    await fs.promises.writeFile(finalPath, pdfBuffer);

    console.log(`PDF saved at: ${finalPath}`);
    return finalPath;

  } catch (error) {
    console.error("Error saving PDF:", error);
    throw error;
  }
}

module.exports = { generatePdf, savePdfToUploads };