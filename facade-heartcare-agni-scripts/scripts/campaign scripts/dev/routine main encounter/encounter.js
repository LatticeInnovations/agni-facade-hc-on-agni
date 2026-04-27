/**
 * FHIR Encounter - Add serviceType (Facility) Updater
 *
 * Usage:
 *   node update-Encounter-service-type.js --env dev --token <your_token>
 *   node update-Encounter-service-type.js --env prod --token <your_token>
 *   node update-Encounter-service-type.js --env dev --token <your_token> --dry-run
 *
 * Alternatively, set the token via environment variable (recommended for prod):
 *   FHIR_TOKEN=<your_token> node update-Encounter-service-type.js --env prod
 *
 * Requirements:
 *   - Node.js 18+
 *   - A Encounter.json file in the same directory (FHIR Bundle or array of Encounter resources)
 */

"use strict";

const fs    = require("fs");
const path  = require("path");
const http  = require("http");
const https = require("https");

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const SERVER_URLS = {
  dev:  "http://143.110.253.49/fhir",
  test: "http://test-server/fhir",   // update as needed
  prod: "http://prod-server/fhir",   // update as needed
};

const TYPE_TO_ADD = [
  {
      "coding": [
          {
              "system": "https://your-custom-coding-system",
              "code": "facility-main-encounter",
              "display": "facility-main-encounter",
          }
      ]
  }
]

const EncounterS_FILE = path.join(__dirname, "encounter.json");

// ─── CLI ARGS ─────────────────────────────────────────────────────────────────

function parseCliArgs() {
  const args = process.argv.slice(2);
  const get  = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : undefined; };
  const has  = (flag) => args.includes(flag);

  const env       = get("--env") ?? get("-e") ?? "dev";
  const customUrl = get("--base-url");
  const dryRun    = has("--dry-run");
  const baseUrl   = customUrl ?? SERVER_URLS[env];

  // Token: --token flag takes priority, then FHIR_TOKEN env var
  const token = "eyJhbGciOiJIUzI1NiJ9.eyJhY2NvdW50X2NyZWF0aW9uX3RpbWVzdGFtcCI6IjIwMjYtMDMtMTFUMDg6MTg6MTMuMjk3NDMwIiwidXNlcl9pZCI6IlVzZXIwNSIsIm5hbWUiOiJEZWZhdWx0UiBSZWNlcHRpb25pc3QiLCJ1c2VyX3R5cGVfaWQiOjMsInVzZXJfcHJpbWFyeV9pZCI6MTYsImZoaXJfaWQiOiIyNjYiLCJzdWIiOiJuaXNoaXRhQHRoZWxhdHRpY2UuaW4iLCJpYXQiOjE3NzY0MjUwMzQsImV4cCI6MTc3NzAyOTgzNH0.zRAQubqt4khKgQA-oqKrVdSg3yLM50Ho6iTzjl4GwvM"

  if (!baseUrl) {
    console.error(`Unknown env "${env}". Use --base-url or one of: ${Object.keys(SERVER_URLS).join(", ")}`);
    process.exit(1);
  }

  if (!token) {
    console.error(`No token provided. Use --token <your_token> or set the FHIR_TOKEN environment variable.`);
    process.exit(1);
  }

  return { env, baseUrl, dryRun, token };
}

// ─── FILE LOADING ─────────────────────────────────────────────────────────────

function loadEncounters(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`Encounter.json not found at: ${filePath}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  if (Array.isArray(raw)) return raw;
  if (raw.resourceType === "Bundle" && Array.isArray(raw.entry)) {
    return raw.entry.map((e) => e.resource).filter(Boolean);
  }
  if (raw.resourceType === "Encounter") return [raw];

  console.error("Encounter.json must be a FHIR Bundle, array of Encounters, or a single Encounter resource.");
  process.exit(1);
}

// ─── Encounter HELPERS ─────────────────────────────────────────────────────────

function alreadyHasType(Encounter) {
  return !!Encounter.type;
}

function addType(Encounter) {
  return { ...Encounter, type: TYPE_TO_ADD };
}

// ─── HTTP REQUEST ─────────────────────────────────────────────────────────────

function httpRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const lib       = parsedUrl.protocol === "https:" ? https : http;

    const reqOptions = {
      hostname: parsedUrl.hostname,
      port:     parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
      path:     parsedUrl.pathname + parsedUrl.search,
      method:   options.method ?? "GET",
      headers:  options.headers ?? {},
    };

    const req = lib.request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        resolve({ status: res.statusCode, statusMessage: res.statusMessage, body: data });
      });
    });

    req.on("error", (err) => {
      if (err.code === "ECONNREFUSED") {
        reject(new Error(`Connection refused at ${parsedUrl.hostname}:${reqOptions.port} — is the server running?`));
      } else if (err.code === "ENOTFOUND") {
        reject(new Error(`Host not found: "${parsedUrl.hostname}" — check your SERVER_URLS config.`));
      } else if (err.code === "ETIMEDOUT") {
        reject(new Error(`Connection timed out to ${url}`));
      } else {
        reject(new Error(`Network error [${err.code}]: ${err.message}`));
      }
    });

    if (body) req.write(body);
    req.end();
  });
}

async function putEncounter(baseUrl, token, Encounter) {
  const url  = `${baseUrl}/Encounter/${Encounter.id}`;
  const body = JSON.stringify(Encounter);

  const res = await httpRequest(url, {
    method: "PUT",
    headers: {
      "Content-Type":   "application/fhir+json",
      "Content-Length": Buffer.byteLength(body),
      "Authorization":  `Bearer ${token}`,
    },
  }, body);

  if (res.status === 401) {
    throw new Error(`Unauthorized (401) — token is missing, expired, or invalid.`);
  }
  if (res.status === 403) {
    throw new Error(`Forbidden (403) — token does not have permission to update Encounters.`);
  }
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`HTTP ${res.status} ${res.statusMessage} — ${res.body}`);
  }

  return JSON.parse(res.body);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  const { env, baseUrl, dryRun, token } = parseCliArgs();

  console.log(`\n🏥  FHIR Encounter serviceType Updater`);
  console.log(`   Environment : ${env}`);
  console.log(`   Server URL  : ${baseUrl}`);
  console.log(`   Dry run     : ${dryRun}`);
  console.log(`   Token       : ${token.slice(0, 6)}${"*".repeat(10)} (truncated for safety)`);
  console.log(`   Source file : ${EncounterS_FILE}\n`);

  const Encounters = loadEncounters(EncounterS_FILE);
  console.log(`📋  Loaded ${Encounters.length} Encounter(s) from file.\n`);

  const results = { skipped: 0, updated: 0, failed: 0 };

  for (const Encounter of Encounters) {
    const id = Encounter.id ?? "(no id)";

    if (!Encounter.id) {
      console.warn(`  ⚠️  Encounter without id — skipped.`);
      results.skipped++;
      continue;
    }

    if (alreadyHasType(Encounter)) {
      console.log(`  ⏭️  Encounter/${id} — serviceType already present, skipping.`);
      results.skipped++;
      continue;
    }

    const updated = addType(Encounter);

    if (dryRun) {
      console.log(`  🔍  [DRY RUN] Would PUT Encounter/${id}`);
      console.log(`      serviceType:`, JSON.stringify(updated.serviceType, null, 2));
      results.updated++;
      continue;
    }

    try {
      await putEncounter(baseUrl, token, updated);
      console.log(`  ✅  Encounter/${id} — updated successfully.`);
      results.updated++;
    } catch (err) {
      console.error(`  ❌  Encounter/${id} — FAILED: ${err.message}`);
      results.failed++;
    }
  }

  console.log(`\n📊  Summary`);
  console.log(`   Updated : ${results.updated}`);
  console.log(`   Skipped : ${results.skipped}`);
  console.log(`   Failed  : ${results.failed}\n`);

  if (results.failed > 0) process.exit(1);
}

main();