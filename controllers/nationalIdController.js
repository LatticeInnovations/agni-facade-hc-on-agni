 
 const fs = require("fs")
const { sequelize } = require("../models");
const { QueryTypes } = require("sequelize");
 const { fullSync, FILE_PATH } = require("../services/syncService");
 
// login by using email or mobile number to send OTP
let getPaginatedNationalIds = async function (req, res) {
  try {


     const offset = parseInt(req.query._offset) || 0;
    const count  = parseInt(req.query._count)  || 10000;


    // Read and parse file
    const allData = JSON.parse(fs.readFileSync(FILE_PATH, "utf8"));

    const totalRecords = allData.length;
    const data         = allData.slice(offset, offset + count);
    const hasNextPage  = offset + count < totalRecords;

    
    // Get last successful sync time
    const [lastSync] = await sequelize.query(
      `SELECT finished_at FROM sync_log
       WHERE sync_id = 'national-id-sync' AND status = 'success'
       ORDER BY finished_at DESC
       LIMIT 1`,
      { type: QueryTypes.SELECT }
    );

     const lastSyncedAt = lastSync
      ? new Date(parseInt(lastSync.finished_at)).toISOString()
      : null;

      const finalData = data.map(nationalIdData => ({
        ...nationalIdData,
        lastSyncedAt
      }))

    return res.json({
      status:      hasNextPage ? 1 : 2,   // 1 = more pages, 2 = last page
      message:     "National id data fetched",
      total:       totalRecords,
      data: finalData,
      error: null
    });

  } catch (err) {
    console.error("[national-id] Read error:", err);
    return res.status(500).json({ status: 0, message: "Failed to read data", error: "Failed to fetch" });
  }
}

module.exports = {getPaginatedNationalIds}