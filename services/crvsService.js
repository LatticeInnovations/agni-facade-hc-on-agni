const axios = require("axios");
let config = require("../config/nodeConfig");
const BASE_URL = config.crvsBaseUrl;

const COMMON_PAYLOAD = {
  nationalid: "9",
  limit: "10000", 
  user: config.crvsUsername,
  password: config.crvsPassword
};

async function getTotalPages() {
  const res = await axios.post(BASE_URL, new URLSearchParams({
    ...COMMON_PAYLOAD,
    pageno: "1",
    schemaname: "paginated-count"
  }));

  return Number.parseInt(res.data[0].total_pages);
}

async function fetchPage(page) {
  const res = await axios.post(BASE_URL, new URLSearchParams({
    ...COMMON_PAYLOAD,
    pageno: String(page),
    schemaname: "paginated"
  }));

  return res.data.map(r => ({
    nationalId: r.national_id,
    firstName: r.first_name,
    middleName: r.middle_name || "",
    lastName: r.last_name,
    dob: r.date_of_birth,
    gender: r.gender,
    updatedAt: Date.now()
  }));
}

module.exports = { getTotalPages, fetchPage };