const fs = require("fs");
const path = require("path");
const { getTotalPages, fetchPage } = require("./crvsService");
const { sequelize } = require("../models");
const { QueryTypes } = require("sequelize");

const FILE_PATH = path.join(__dirname, "nationalData.json");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fullSync() {
  const startedAt = Date.now();
  let totalRecords = 0;
  let status = "success";
  let error = null;

  try {
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

    totalRecords = allData.length;
    fs.writeFileSync(FILE_PATH, JSON.stringify(allData));
    console.log(`[sync] JSON file updated — ${totalRecords} records`);

  } catch (err) {
    status = "failed";
    error = err.message;
    console.error("[sync] Failed:", err);
    throw err;
  } finally {
    await sequelize.query(
      `INSERT INTO sync_log (sync_id, started_at, finished_at, status, inserted, error)
       VALUES (?, ?, ?, ?, ?, ?)`,
      {
        replacements: [
          "national-id-sync",
          startedAt,
          Date.now(),
          status,
          totalRecords,
          error,
        ],
        type: QueryTypes.INSERT,
      }
    ).catch(err => console.error("[sync] Failed to write sync_log:", err));
  }
}

module.exports = { fullSync, FILE_PATH };