const axios = require("axios");
let config = require("../config/nodeConfig");
const BASE_URL = config.crvsBaseUrl;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

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

async function fetchPageWithRetry(page, retries = 0) {
  try {
    const res = await axios.post(BASE_URL, new URLSearchParams({
      ...COMMON_PAYLOAD,
      pageno: String(page),
      schemaname: "paginated"
    }));

    return res.data.map(r => ({
      nationalId:  r.national_id,
      firstName:   r.first_name,
      middleName:  r.middle_name || "",
      lastName:    r.last_name,
      dob:         r.date_of_birth,
      gender:      r.gender,
      updatedAt:   Date.now()
    }));

  } catch (err) {
    if (retries < MAX_RETRIES) {
      console.warn(`[crvs] Page ${page} failed (${err.code}) — retrying ${retries + 1}/${MAX_RETRIES} in ${RETRY_DELAY_MS}ms`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return fetchPageWithRetry(page, retries + 1);
    }
    console.error(`[crvs] Page ${page} failed after ${MAX_RETRIES} retries`);
    throw err;
  }
}

async function fetchPage(page) {
  return fetchPageWithRetry(page);
}


module.exports = { getTotalPages, fetchPage };