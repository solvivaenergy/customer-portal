// Copies the monitoring Supabase URL + anon key from solviva-inquiry/.env into ./.env.local
// without printing either value. Re-run whenever the keys rotate.
import fs from "node:fs";
import path from "node:path";

const SOURCE = "C:\\Users\\roald\\Documents\\GitHub\\solviva-inquiry\\.env";
const TARGET = path.resolve(process.cwd(), ".env.local");

const src = {};
for (const line of fs.readFileSync(SOURCE, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) src[m[1]] = m[2].trim();
}
const needed = { VITE_SUPABASE_URL: "MONITORING_SUPABASE_URL", VITE_SUPABASE_ANON_KEY: "MONITORING_SUPABASE_ANON_KEY" };
const missing = Object.values(needed).filter((k) => !src[k]);
if (missing.length) {
  console.error(`Missing in solviva-inquiry/.env: ${missing.join(", ")}`);
  process.exit(1);
}

const existing = {};
if (fs.existsSync(TARGET)) {
  for (const line of fs.readFileSync(TARGET, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) existing[m[1]] = m[2];
  }
}
const out = {
  ...existing,
  VITE_SUPABASE_URL: src.MONITORING_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: src.MONITORING_SUPABASE_ANON_KEY,
  VITE_MONITORING_API_URL: existing.VITE_MONITORING_API_URL ?? "/api/monitoring",
  VITE_N8N_WEBHOOK_URL: existing.VITE_N8N_WEBHOOK_URL ?? "/api/n8n",
  VITE_ENABLE_SUBMISSIONS: existing.VITE_ENABLE_SUBMISSIONS ?? "false",
};
fs.writeFileSync(TARGET, Object.entries(out).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
console.log(`Wrote ${Object.keys(out).length} variables to .env.local: ${Object.keys(out).join(", ")}`);
