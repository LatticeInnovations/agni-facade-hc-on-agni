const cron = require("node-cron");
const { fullSync } = require("../../services/syncService");

// every 14 days at 2 AM
cron.schedule("0 2 */14 * *", async () => {
  console.log("Running national ID sync...");

  try {
    await fullSync();
    console.log("Sync completed");
  } catch (err) {
    console.error("Sync failed", err);
  }
});