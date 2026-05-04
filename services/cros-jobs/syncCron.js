"use strict";

const cron = require("node-cron");
const { fullSync } = require("../../services/syncService");

let isSyncing = false;

async function runSync() {
  if (isSyncing) {
    console.warn("[cron] Previous sync still running — skipping");
    return;
  }

  isSyncing = true;
  console.log("[sync] Starting weekly sync...");

  try {
    await fullSync();
  } catch (err) {
    console.error("[sync] Sync error:", err.message);
  } finally {
    isSyncing = false;
  }
}

// Every Sunday at midnight

cron.schedule("0 0 * * 0", runSync, {
  timezone: "Pacific/Efate"  // Vanuatu timezone
});


console.log("[cron] Weekly sync scheduler running");

module.exports = { runSync };