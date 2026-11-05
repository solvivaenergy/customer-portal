// Builds the portal for https://www.solvivaenergy.com/mysolviva and, with --deploy, publishes it as the
// Cloudflare Worker "customer-portal" (wrangler.toml). Used by .github/workflows/production.yml and by hand:
//
//   node scripts/build-production.mjs            build only (dist/)
//   node scripts/build-production.mjs --deploy   build, then `wrangler deploy`
//
// Build settings come from the environment when set (the workflow passes the repository variables) and
// fall back to the production defaults below. Supabase URL + anon key are read by Vite from the
// environment or .env.local (node scripts/sync-env.mjs). For a local deploy the Cloudflare token and
// account id are taken from solviva-inquiry/.env when they are not in the environment; nothing is printed.
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const DEFAULTS = {
  BASE_PATH: "/mysolviva/",
  VITE_MONITORING_API_URL: "https://monitoring.solvivaenergy.com",
  // Until production copies of the portal workflows exist (docs/integrations.md), the production site
  // reads and writes odoo.sh staging through the [STAGING] n8n workflows, like the demo.
  VITE_N8N_WEBHOOK_URL: "https://solviva.app.n8n.cloud/webhook/staging",
  VITE_ENABLE_SUBMISSIONS: "true",
  // Request PMS is switched off (the Support hub shows "Coming soon") until the PMS intake is agreed.
  VITE_ENABLE_PMS: "false",
};
for (const [k, v] of Object.entries(DEFAULTS)) if (!process.env[k]) process.env[k] = v;

const deploy = process.argv.includes("--deploy");
if (deploy) {
  const SHARED_ENV = "C:\\Users\\roald\\Documents\\GitHub\\solviva-inquiry\\.env";
  const wanted = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"];
  if (wanted.some((k) => !process.env[k]) && fs.existsSync(SHARED_ENV)) {
    for (const line of fs.readFileSync(SHARED_ENV, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && wanted.includes(m[1]) && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
    }
  }
  const missing = wanted.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Cannot deploy: ${missing.join(", ")} not set (environment or solviva-inquiry/.env).`);
    process.exit(1);
  }
}

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

console.log(`Building for ${process.env.BASE_PATH} (n8n: ${process.env.VITE_N8N_WEBHOOK_URL}, submissions: ${process.env.VITE_ENABLE_SUBMISSIONS}, PMS: ${process.env.VITE_ENABLE_PMS})`);
run("npm", ["run", "build"]);
if (deploy) run("npx", ["wrangler", "deploy"]);
