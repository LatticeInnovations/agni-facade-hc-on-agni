const fs = require("fs");
const path = require("path");
const { getTotalPages, fetchPage } = require("./crvsService");

const FILE_PATH = path.join(__dirname, "nationalData.json");
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fullSync() {

    const filePath = path.join(__dirname, "nationalData.json");

    const data = JSON.parse(
        fs.readFileSync(filePath, "utf-8")
    );

    const csv = data.map(d => {
        const escape = (val) => {
            if (val === null || val === undefined) return '';
            return `"${String(val).replace(/"/g, '""')}"`; // handle quotes too
        };

        return [
            escape(d.nationalId),
            escape(d.firstName),
            escape(d.middleName),
            escape(d.lastName),
            escape(d.dob),
            escape(d.gender)
        ].join(",");
    }).join("\n");
    fs.writeFileSync(
        path.join(__dirname, "nationalData.csv"),
        csv
    );
}

module.exports = { fullSync, FILE_PATH };