/**
 * FHIR AllergyIntolerance - Add code (Facility Allergy) Updater
 *
 * Usage:
 *   node update-allergy-intolerance-code.js --env dev --token <your_token>
 *   node update-allergy-intolerance-code.js --env prod --token <your_token>
 *   node update-allergy-intolerance-code.js --env dev --token <your_token> --dry-run
 *
 * Alternatively, set the token via environment variable (recommended for prod):
 *   FHIR_TOKEN=<your_token> node update-allergy-intolerance-code.js --env prod
 *
 * Requirements:
 *   - Node.js 18+
 *   - An allergyIntolerance.json file in the same directory
 *     (FHIR Bundle, array of AllergyIntolerance resources, or a single resource)
 *   - /AllergyIntolerance?code:missing=true&_count=1000
 */

"use strict";

const fs    = require("fs");
const path  = require("path");
const http  = require("http");
const https = require("https");

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const SERVER_URLS = {
  dev:  "http://143.110.253.49/fhir",
  test: "http://test-server/fhir",   // update as needed
  prod: "http://prod-server/fhir",   // update as needed
};

const CODE_TO_ADD = {
  coding: [
    {
      system: "https://your-custom-coding-system",
      code:   "facility-allergy",
    },
  ],
};

const ALLERGY_FILE = path.join(__dirname, "allergyIntolerance.json");

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
  const token = get("--token") ?? process.env.FHIR_TOKEN;

  if (!baseUrl) {
    console.error(`Unknown env "${env}". Use --base-url or one of: ${Object.keys(SERVER_URLS).join(", ")}`);
    process.exit(1);
  }

  if (!token) {
    console.error("No token provided. Use --token <your_token> or set the FHIR_TOKEN environment variable.");
    process.exit(1);
  }

  return { env, baseUrl, dryRun, token };
}

// ─── FILE LOADING ─────────────────────────────────────────────────────────────

function loadAllergyIntolerances(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`allergyIntolerance.json not found at: ${filePath}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  if (Array.isArray(raw)) return raw;
  if (raw.resourceType === "Bundle" && Array.isArray(raw.entry)) {
    return raw.entry.map((e) => e.resource).filter(Boolean);
  }
  if (raw.resourceType === "AllergyIntolerance") return [raw];

  console.error(
    "allergyIntolerance.json must be a FHIR Bundle, an array of AllergyIntolerance resources, or a single AllergyIntolerance resource."
  );
  process.exit(1);
}

// ─── ALLERGY INTOLERANCE HELPERS ──────────────────────────────────────────────

/**
 * Returns true if the resource already has a `code` field with at least one coding entry.
 */
function alreadyHasCode(resource) {
  return (
    resource.code &&
    resource.code.coding &&
    Array.isArray(resource.code.coding) &&
    resource.code.coding.length > 0
  );
}

/**
 * Returns a new resource object with the `code` field added.
 */
function addCode(resource) {
  return { ...resource, code: CODE_TO_ADD };
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

async function putAllergyIntolerance(baseUrl, token, resource) {
  const url  = `${baseUrl}/AllergyIntolerance/${resource.id}`;
  const body = JSON.stringify(resource);

  const res = await httpRequest(
    url,
    {
      method: "PUT",
      headers: {
        "Content-Type":   "application/fhir+json",
        "Content-Length": Buffer.byteLength(body),
        "Authorization":  `Bearer ${token}`,
      },
    },
    body
  );

  if (res.status === 401) {
    throw new Error("Unauthorized (401) — token is missing, expired, or invalid.");
  }
  if (res.status === 403) {
    throw new Error("Forbidden (403) — token does not have permission to update AllergyIntolerance resources.");
  }
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`HTTP ${res.status} ${res.statusMessage} — ${res.body}`);
  }

  return JSON.parse(res.body);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  const { env, baseUrl, dryRun, token } = parseCliArgs();

  console.log("\n🏥  FHIR AllergyIntolerance Code Updater");
  console.log(`   Environment : ${env}`);
  console.log(`   Server URL  : ${baseUrl}`);
  console.log(`   Dry run     : ${dryRun}`);
  console.log(`   Token       : ${token.slice(0, 6)}${"*".repeat(10)} (truncated for safety)`);
  console.log(`   Source file : ${ALLERGY_FILE}\n`);

  const resources = loadAllergyIntolerances(ALLERGY_FILE);
  console.log(`📋  Loaded ${resources.length} AllergyIntolerance resource(s) from file.\n`);

  const results = { skipped: 0, updated: 0, failed: 0 };

  for (const resource of resources) {
    const id = resource.id ?? "(no id)";

    if (resource.resourceType !== "AllergyIntolerance") {
      console.warn(`  ⚠️  Resource ${id} is not an AllergyIntolerance (got "${resource.resourceType}") — skipped.`);
      results.skipped++;
      continue;
    }

    if (!resource.id) {
      console.warn("  ⚠️  AllergyIntolerance without id — skipped.");
      results.skipped++;
      continue;
    }

    if (alreadyHasCode(resource)) {
      console.log(`  ⏭️  AllergyIntolerance/${id} — code already present, skipping.`);
      results.skipped++;
      continue;
    }

    const updated = addCode(resource);

    if (dryRun) {
      console.log(`  🔍  [DRY RUN] Would PUT AllergyIntolerance/${id}`);
      console.log(`      code:`, JSON.stringify(updated.code, null, 2));
      results.updated++;
      continue;
    }

    try {
      await putAllergyIntolerance(baseUrl, token, updated);
      console.log(`  ✅  AllergyIntolerance/${id} — updated successfully.`);
      results.updated++;
    } catch (err) {
      console.error(`  ❌  AllergyIntolerance/${id} — FAILED: ${err.message}`);
      results.failed++;
    }
  }

  console.log("\n📊  Summary");
  console.log(`   Updated : ${results.updated}`);
  console.log(`   Skipped : ${results.skipped}`);
  console.log(`   Failed  : ${results.failed}\n`);

  if (results.failed > 0) process.exit(1);
}

main();

// node update-allergy-intolerance-code.js --env dev --token eyJhbGciOiJIUzI1NiJ9.eyJhY2NvdW50X2NyZWF0aW9uX3RpbWVzdGFtcCI6IjIwMjYtMDMtMTFUMDg6MTg6MTMuMjk3NDMwIiwidXNlcl9pZCI6IlVzZXIwNSIsIm5hbWUiOiJEZWZhdWx0UiBSZWNlcHRpb25pc3QiLCJ1c2VyX3R5cGVfaWQiOjMsInVzZXJfcHJpbWFyeV9pZCI6MTYsImZoaXJfaWQiOiIyNjYiLCJzdWIiOiJuaXNoaXRhQHRoZWxhdHRpY2UuaW4iLCJpYXQiOjE3NzY0MjUwMzQsImV4cCI6MTc3NzAyOTgzNH0.zRAQubqt4khKgQA-oqKrVdSg3yLM50Ho6iTzjl4GwvM

// http://143.110.253.49/fhir/AllergyIntolerance?code:missing=true&_count=1000