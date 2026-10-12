/**
 * Creates (or updates) the two STAGING n8n workflows the portal uses, cloned from the production
 * ones but pointed at the odoo.sh staging build:
 *
 *   [STAGING] Portal Support Intake → Odoo   POST /webhook/staging/webflow-customer-support
 *   [STAGING] Portal Get My Tickets → Odoo   POST /webhook/staging/get-my-tickets
 *
 * Environment values come from n8n variables at run time (nothing is hard-coded here):
 *   ODOO_SH_STAGING_URL / _DB / _USER / _KEY          staging host + JSON-RPC credentials
 *   Ticket_Production_Technical_Odoo                 only its PATH is reused: odoo.sh staging is a
 *                                                     copy of production, so the Odoo webhook UUID
 *                                                     is the same on both builds.
 *
 * Production workflows are only READ (cloned); they are never modified.
 * Needs N8N_URL and N8N_API_KEY in solviva-inquiry/.env.   Run: node scripts/n8n/create-staging-workflows.mjs
 */
import fs from "node:fs";

const ENV_FILE = "C:/Users/roald/Documents/GitHub/solviva-inquiry/.env";
for (const line of fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const BASE = (process.env.N8N_URL || "").replace(/\/$/, "");
const KEY = process.env.N8N_API_KEY;
if (!BASE || !KEY) throw new Error("N8N_URL / N8N_API_KEY missing in solviva-inquiry/.env");

const PROD_INTAKE_ID = "SIfXbytr8hfedN2q"; // "Webflow Customer Support to CRM"
const PROD_LIST_ID = "7MNq5iD7k7H7nQLw"; // "Get My Tickets - Odoo Proxy"

async function api(method, path, body) {
  const r = await fetch(`${BASE}/api/v1${path}`, {
    method,
    headers: { "X-N8N-API-KEY": KEY, "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const clone = (wf, name) => {
  const n = wf.nodes.find((x) => x.name === name);
  if (!n) throw new Error(`Node "${name}" not found in workflow ${wf.name}`);
  // Drop ids and production's continue-on-fail flags: a failed Odoo call must fail the run
  // (the webhook then answers 500 and the portal shows an error) instead of returning an error item.
  const { id: _id, webhookId: _w, onError: _e, continueOnFail: _c, ...rest } = structuredClone(n);
  return rest;
};
/** Rewrite every $('Some Node') reference inside a node's parameters to the given node name. */
const retarget = (node, to) => {
  node.parameters = JSON.parse(JSON.stringify(node.parameters).replace(/\$\('[^']+'\)/g, `$('${to}')`));
  return node;
};

// Staging hook = staging host + the production hook's path (same UUID on both builds).
// (Kept regex-free apart from the trailing-slash trim: n8n's expression parser mis-reads "/" inside a character class.)
const STAGING_HOOK = String.raw`={{ $vars.ODOO_SH_STAGING_URL.replace(/\/+$/, '') + '/web/hook/' + $vars.Ticket_Production_Technical_Odoo.split('/web/hook/')[1] }}`;
const STAGING_JSONRPC = String.raw`={{ $vars.ODOO_SH_STAGING_URL.replace(/\/+$/, '') + '/jsonrpc' }}`;

function buildIntake(prod) {
  const webhook = clone(prod, "Webhook from Solviva Site");
  webhook.name = "Webhook";
  webhook.position = [0, 300];
  webhook.parameters = { ...webhook.parameters, httpMethod: "POST", path: "staging/webflow-customer-support", responseMode: "lastNode" };

  const sw = retarget(clone(prod, "Technical or General?1"), "Webhook");
  sw.name = "Technical or General?";
  sw.position = [260, 300];

  const tech = retarget(clone(prod, "POST Technical to Odoo Prod"), "Webhook");
  tech.name = "POST Technical to Odoo Staging";
  tech.position = [560, 180];
  tech.parameters.url = STAGING_HOOK;

  const gen = retarget(clone(prod, "POST General to Odoo prod"), "Webhook");
  gen.name = "POST General to Odoo Staging";
  gen.position = [560, 420];
  gen.parameters.url = STAGING_HOOK;

  return {
    name: "[STAGING] Portal Support Intake → Odoo",
    nodes: [webhook, sw, tech, gen],
    connections: {
      Webhook: { main: [[{ node: "Technical or General?", type: "main", index: 0 }]] },
      "Technical or General?": {
        main: [
          [{ node: "POST Technical to Odoo Staging", type: "main", index: 0 }],
          [{ node: "POST General to Odoo Staging", type: "main", index: 0 }],
        ],
      },
    },
    settings: { executionOrder: "v1" },
  };
}

function buildList(prod) {
  const webhook = clone(prod, "Webhook");
  webhook.position = [0, 300];
  webhook.parameters = { ...webhook.parameters, httpMethod: "POST", path: "staging/get-my-tickets", responseMode: "responseNode" };

  const auth = clone(prod, "Odoo Authenticate");
  auth.position = [260, 300];
  auth.parameters.url = STAGING_JSONRPC;
  // The production node's body lacks the "=" prefix, so its {{ $vars }} are sent literally. Fix that here.
  auth.parameters.body =
    "=" +
    JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      id: 1,
      params: { service: "common", method: "authenticate", args: ["{{ $vars.ODOO_SH_STAGING_DB }}", "{{ $vars.ODOO_SH_STAGING_USER }}", "{{ $vars.ODOO_SH_STAGING_KEY }}", {}] },
    });

  const search = clone(prod, "Odoo Search Tickets");
  search.position = [520, 300];
  search.parameters.url = STAGING_JSONRPC;
  search.parameters.body = String(search.parameters.body)
    .replace(/\$vars\.ODOO_SH_PROD_DB/g, "$vars.ODOO_SH_STAGING_DB")
    .replace(/\$vars\.ODOO_API_KEY/g, "$vars.ODOO_SH_STAGING_KEY")
    .replace("['partner_email', '=',", "['partner_email', '=ilike',")
    .replace("'partner_name'", "'partner_name', 'ticket_ref', 'team_id', 'tag_ids'");

  const respond = clone(prod, "Respond to Webhook");
  respond.position = [780, 300];
  // Surface Odoo errors instead of silently answering [] (the portal shows them).
  respond.parameters.responseBody = "={{ JSON.stringify($json.result ?? { error: $json.error?.data?.message ?? $json.error?.message ?? 'Odoo request failed' }) }}";

  return {
    name: "[STAGING] Portal Get My Tickets → Odoo",
    nodes: [webhook, auth, search, respond],
    connections: {
      Webhook: { main: [[{ node: "Odoo Authenticate", type: "main", index: 0 }]] },
      "Odoo Authenticate": { main: [[{ node: "Odoo Search Tickets", type: "main", index: 0 }]] },
      "Odoo Search Tickets": { main: [[{ node: "Respond to Webhook", type: "main", index: 0 }]] },
    },
    settings: { executionOrder: "v1" },
  };
}

// Team project that owns the production workflows AND the project-scoped Ticket_* variables.
// A workflow created through the API lands in the key owner's personal project, where those
// variables resolve to undefined, so each workflow is transferred here after creation.
const TEAM_PROJECT = "6j9G8Frdi2YzcLQi"; // "Solviva n8n Projects"

async function upsert(def) {
  const existing = (await api("GET", "/workflows?limit=250")).data.find((w) => w.name === def.name);
  let wf;
  if (existing) {
    wf = await api("PUT", `/workflows/${existing.id}`, def);
    console.log(`updated  ${def.name} (${wf.id})`);
  } else {
    wf = await api("POST", "/workflows", def);
    console.log(`created  ${def.name} (${wf.id})`);
  }
  const full = await api("GET", `/workflows/${wf.id}`);
  if (!(full.shared || []).some((s) => s.projectId === TEAM_PROJECT)) {
    await api("PUT", `/workflows/${wf.id}/transfer`, { destinationProjectId: TEAM_PROJECT });
    console.log(`moved    ${wf.id} to project ${TEAM_PROJECT}`);
  }
  if (!wf.active) {
    await api("POST", `/workflows/${wf.id}/activate`);
    console.log(`activated ${wf.id}`);
  }
  return wf;
}

const prodIntake = await api("GET", `/workflows/${PROD_INTAKE_ID}`);
const prodList = await api("GET", `/workflows/${PROD_LIST_ID}`);
await upsert(buildIntake(prodIntake));
await upsert(buildList(prodList));
console.log(`\nwebhooks:\n  ${BASE}/webhook/staging/webflow-customer-support\n  ${BASE}/webhook/staging/get-my-tickets`);
