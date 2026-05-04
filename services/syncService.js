const fs = require("fs");
const path = require("path");
const { getTotalPages, fetchPage } = require("./crvsService");

const FILE_PATH = path.join(__dirname, "nationalData.json");
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fullSync() {
  const totalPages = await getTotalPages();
  console.log("Total Pages:", totalPages);

  let allData = [];
  const batchSize = 5;

  for (let i = 1; i <= totalPages; i += batchSize) {
    const promises = [];

    for (let j = i; j < i + batchSize && j <= totalPages; j++) {
      promises.push(fetchPage(j));
    }

    const results = await Promise.all(promises);
    allData.push(...results.flat());

    console.log(`Fetched till page ${i}`);
    await sleep(1000);
  }

  fs.writeFileSync(FILE_PATH, JSON.stringify(allData));
  console.log("JSON file updated");
}

module.exports = { fullSync, FILE_PATH };