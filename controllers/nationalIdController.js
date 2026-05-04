 
 const fs = require("fs")

 const { fullSync, FILE_PATH } = require("../services/syncService");
// login by using email or mobile number to send OTP
let getPaginatedNationalIds = async function (req, res) {
          try {
            const page  = parseInt(req.query.pageNo);
            const limit = parseInt(req.query.limit);

    // Read and parse file
    const allData = JSON.parse(fs.readFileSync(FILE_PATH, "utf8"));

    const totalRecords = allData.length;
    const totalPages   = Math.ceil(totalRecords / limit);
    const start        = (page - 1) * limit;
    const data         = allData.slice(start, start + limit);
    const currentRecords = data.length

    return res.json({
      currentPage:   page,
      totalPages,
      totalRecords,
      data,
      currentRecords
    });

  } catch (err) {
    console.error("[national-id] Read error:", err);
    return res.status(500).json({ status: 0, message: "Failed to read data", data: [] });
  }
}

module.exports = {getPaginatedNationalIds}