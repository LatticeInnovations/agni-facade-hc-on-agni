const puppeteer = require("puppeteer");

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
waitUntil: "networkidle0"
});

const pdf = await page.pdf({
format: "A4",
printBackground: true
});

await browser.close();

return pdf;

}

module.exports = { generatePdf };