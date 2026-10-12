/**
 * Creates (or updates) the two STAGING n8n workflows the portal uses, cloned from the production
 * ones but pointed at the odoo.sh staging build:
 *
 *   [STAGING] Portal Support Intake → Odoo   POST /webhook/staging/webflow-customer-support  (helpdesk.ticket)
 *   [STAGING] Portal Get My Tickets → Odoo   POST /webhook/staging/get-my-tickets            (helpdesk.ticket)
 *   [STAGING] Portal Get My PMS → Odoo       POST /webhook/staging/get-my-pms                (maintenance.request)
 *   [STAGING] Portal PMS Request → Odoo      POST /webhook/staging/pms-request               (maintenance.request create)
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
    // Substring match: Odoo often stores partner_email as "Name" <email>, which an exact match misses.
    .replace("['partner_email', '=',", "['partner_email', 'ilike',")
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

/* ------------------------------------------------------------------ PMS (Maintenance app) */

const PMS_FIELDS = [
  "id", "name", "stage_id", "kanban_state", "maintenance_type", "request_date", "schedule_date", "close_date", "create_date",
  "user_id", "description", "x_pms_email", "x_pms_preferred_date", "x_pms_preferred_time_slot", "x_pms_alt_date",
  "x_pms_site_address", "x_pms_panel_location", "x_pms_access_equipment", "x_pms_work_permit", "x_pms_site_contact_name",
  "x_pms_site_contact_number", "x_pms_access_instructions", "x_pms_has_issues", "x_pms_issue_description", "x_pms_other_requests",
];

/** Lists maintenance.request rows for a customer: by x_pms_email, x_pms_partner_id or x_pms_crm_lead_id. */
function buildPmsList(prodList) {
  const webhook = clone(prodList, "Webhook");
  webhook.position = [0, 300];
  webhook.parameters = { ...webhook.parameters, httpMethod: "POST", path: "staging/get-my-pms", responseMode: "responseNode" };

  const auth = clone(prodList, "Odoo Authenticate");
  auth.position = [260, 300];
  auth.parameters.url = STAGING_JSONRPC;
  auth.parameters.body = "=" + JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: { service: "common", method: "authenticate", args: ["{{ $vars.ODOO_SH_STAGING_DB }}", "{{ $vars.ODOO_SH_STAGING_USER }}", "{{ $vars.ODOO_SH_STAGING_KEY }}", {}] } });

  const search = clone(prodList, "Odoo Search Tickets");
  search.name = "Odoo Search PMS Requests";
  search.position = [520, 300];
  search.parameters.url = STAGING_JSONRPC;
  search.parameters.body =
    "={{ JSON.stringify({ jsonrpc: '2.0', method: 'call', id: 2, params: { service: 'object', method: 'execute_kw', args: [" +
    "$vars.ODOO_SH_STAGING_DB, $('Odoo Authenticate').item.json.result, $vars.ODOO_SH_STAGING_KEY, 'maintenance.request', 'search_read', " +
    "[[ '|', '|', ['x_pms_email', 'ilike', $('Webhook').item.json.body.email || '__no_email__'], " +
    "['x_pms_partner_id', '=', Number($('Webhook').item.json.body.partner_id) || -1], " +
    "['x_pms_crm_lead_id', 'in', ($('Webhook').item.json.body.lead_ids || []).map(Number).filter(Boolean)] ]], " +
    `{ fields: ${JSON.stringify(PMS_FIELDS)}, limit: 50, order: 'create_date desc' }] } }) }}`;

  const respond = clone(prodList, "Respond to Webhook");
  respond.position = [780, 300];
  respond.parameters.responseBody = "={{ JSON.stringify($json.result ?? { error: $json.error?.data?.message ?? $json.error?.message ?? 'Odoo request failed' }) }}";

  return {
    name: "[STAGING] Portal Get My PMS → Odoo",
    nodes: [webhook, auth, search, respond],
    connections: {
      Webhook: { main: [[{ node: "Odoo Authenticate", type: "main", index: 0 }]] },
      "Odoo Authenticate": { main: [[{ node: "Odoo Search PMS Requests", type: "main", index: 0 }]] },
      "Odoo Search PMS Requests": { main: [[{ node: "Respond to Webhook", type: "main", index: 0 }]] },
    },
    settings: { executionOrder: "v1" },
  };
}

/** Creates a maintenance.request from the portal's PMS wizard, with the questionnaire app's field mapping. */
function buildPmsCreate(prodList) {
  const webhook = clone(prodList, "Webhook");
  webhook.position = [0, 300];
  webhook.parameters = { ...webhook.parameters, httpMethod: "POST", path: "staging/pms-request", responseMode: "responseNode" };

  const auth = clone(prodList, "Odoo Authenticate");
  auth.position = [260, 300];
  auth.parameters.url = STAGING_JSONRPC;
  auth.parameters.body = "=" + JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: { service: "common", method: "authenticate", args: ["{{ $vars.ODOO_SH_STAGING_DB }}", "{{ $vars.ODOO_SH_STAGING_USER }}", "{{ $vars.ODOO_SH_STAGING_KEY }}", {}] } });

  const map = {
    name: "Build maintenance.request values",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [520, 300],
    parameters: {
      mode: "runOnceForAllItems",
      jsCode: String.raw`// Same mapping as the PMS questionnaire app (solvivaenergy/pms, server.js POST /pms/api/submit).
const b = $('Webhook').first().json.body || {};
const s = (v) => (v === undefined || v === null) ? '' : String(v).trim();
const need = (k, label) => { const v = s(b[k]); if (!v) throw new Error('Missing ' + (label || k)); return v; };
const first = need('first_name', 'First name'), last = need('last_name', 'Last name'), email = need('email', 'Email');
const contact = need('contact_number', 'Contact number'), site = need('site_address', 'Site address');
const preferred = need('preferred_date', 'Preferred date');
if (!/^\d{4}-\d{2}-\d{2}$/.test(preferred)) throw new Error('preferred_date must be YYYY-MM-DD');
const slotRaw = s(b.preferred_time_slot).toLowerCase();
const slot = slotRaw.startsWith('after') ? 'afternoon' : slotRaw.startsWith('flex') ? 'flexible' : 'morning';
const slotTime = { morning: '08:00:00', afternoon: '13:00:00', flexible: '08:00:00' }[slot];
const equipment = Array.isArray(b.access_equipment) ? b.access_equipment.join(', ') : (s(b.access_equipment) || 'Not specified');
const hasIssues = b.has_issues === true || s(b.has_issues).toLowerCase() === 'yes' || s(b.has_issues).toLowerCase() === 'true';
const partner = Number(b.partner_id) || 0, lead = Number(b.lead_id) || 0;
const manila = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
const description = [
  'PMS REQUEST FORM — SUBMITTED FROM THE CUSTOMER PORTAL ' + manila, '',
  '=== SECTION A: CLIENT & SITE INFORMATION ===',
  'Name: ' + last + ', ' + first, 'Email: ' + email, 'Contact Number: ' + contact, 'Site / Installation Address: ' + site, '',
  '=== SECTION B: PREFERRED PMS SCHEDULE ===',
  'Preferred Date: ' + preferred, 'Preferred Time Slot: ' + slot, 'Alternative Date: ' + (s(b.alternative_date) || 'Not specified'), '',
  '=== SECTION C: SITE ACCESS REQUIREMENTS ===',
  'Panel / Array Location: ' + (s(b.panel_location) || 'Not specified'), 'Access Equipment Required: ' + equipment,
  'Work Permit Required: ' + (s(b.work_permit) || 'Not specified'), 'Work Permit Requirements: ' + (s(b.work_permit_requirements) || 'N/A'),
  'Site Contact Person: ' + (s(b.site_contact_name) || 'Same as above') + (s(b.site_contact_number) ? ' (' + s(b.site_contact_number) + ')' : ''),
  'Additional Access Instructions: ' + (s(b.access_instructions) || 'None'), '',
  '=== SECTION D: SYSTEM CONDITION & CONCERNS ===',
  'Issues Noticed Recently: ' + (hasIssues ? 'Yes' : 'No — everything seems to be working fine'),
  'Issue Description: ' + (s(b.issue_description) || 'N/A'), 'Other Questions or Requests: ' + (s(b.other_requests) || 'None'),
].join('\n');
const vals = {
  name: 'PMS Request — ' + last + ', ' + first + ' (' + preferred + ')',
  maintenance_type: 'preventive', request_date: today, schedule_date: preferred + ' ' + slotTime, description,
  x_pms_last_name: last, x_pms_first_name: first, x_pms_email: email, x_pms_contact_number: contact, x_pms_site_address: site,
  x_pms_preferred_date: preferred, x_pms_preferred_time_slot: slot, x_pms_alt_date: s(b.alternative_date) || false,
  x_pms_panel_location: s(b.panel_location) || false, x_pms_access_equipment: equipment, x_pms_work_permit: s(b.work_permit) || false,
  x_pms_work_permit_requirements: s(b.work_permit_requirements) || false, x_pms_site_contact_name: s(b.site_contact_name) || false,
  x_pms_site_contact_number: s(b.site_contact_number) || false, x_pms_access_instructions: s(b.access_instructions) || false,
  x_pms_has_issues: hasIssues, x_pms_issue_description: s(b.issue_description) || false, x_pms_other_requests: s(b.other_requests) || false,
  x_pms_submission_token: s(b.token) || false,
};
if (partner) vals.x_pms_partner_id = partner;
if (lead) { vals.x_pms_crm_lead_id = lead; vals.x_pms_lead_id = lead; }
return [{ json: { vals } }];`,
    },
  };

  const create = clone(prodList, "Odoo Search Tickets");
  create.name = "Odoo Create PMS Request";
  create.position = [780, 300];
  create.parameters.url = STAGING_JSONRPC;
  create.parameters.body =
    "={{ JSON.stringify({ jsonrpc: '2.0', method: 'call', id: 3, params: { service: 'object', method: 'execute_kw', args: [" +
    "$vars.ODOO_SH_STAGING_DB, $('Odoo Authenticate').item.json.result, $vars.ODOO_SH_STAGING_KEY, 'maintenance.request', 'create', [$json.vals]] } }) }}";

  const respond = clone(prodList, "Respond to Webhook");
  respond.position = [1040, 300];
  respond.parameters.responseBody = "={{ JSON.stringify(typeof $json.result === 'number' ? { id: $json.result } : { error: $json.error?.data?.message ?? $json.error?.message ?? 'Odoo request failed' }) }}";

  return {
    name: "[STAGING] Portal PMS Request → Odoo",
    nodes: [webhook, auth, map, create, respond],
    connections: {
      Webhook: { main: [[{ node: "Odoo Authenticate", type: "main", index: 0 }]] },
      "Odoo Authenticate": { main: [[{ node: "Build maintenance.request values", type: "main", index: 0 }]] },
      "Build maintenance.request values": { main: [[{ node: "Odoo Create PMS Request", type: "main", index: 0 }]] },
      "Odoo Create PMS Request": { main: [[{ node: "Respond to Webhook", type: "main", index: 0 }]] },
    },
    settings: { executionOrder: "v1" },
  };
}

/* ------------------------------------------------------- System details (crm.lead, read-only) */

const LEAD_FIELDS = [
  "id", "name", "x_studio_crm_design_solis_station_id", "x_studio_crm_contract_system_size_kwp", "x_studio_system_size_kwp",
  "x_studio_crm_brand_battery", "x_studio_crm_model_battery", "x_studio_crm_quantity_battery", "x_studio_crm_size_per_unit_kwh_battery",
  "x_studio_crm_brand_inverter", "x_studio_crm_model_inverter", "x_studio_crm_quantity_inverter", "x_studio_crm_size_per_unit_kw_inverter",
  "x_studio_energization_date", "user_id",
];

/** Battery / inverter / energisation / sales rep for the login's own CRM leads (the nightly mirror does not copy these yet). */
function buildSystemDetails(prodList) {
  const webhook = clone(prodList, "Webhook");
  webhook.position = [0, 300];
  webhook.parameters = { ...webhook.parameters, httpMethod: "POST", path: "staging/get-my-system", responseMode: "responseNode" };

  const auth = clone(prodList, "Odoo Authenticate");
  auth.position = [260, 300];
  auth.parameters.url = STAGING_JSONRPC;
  auth.parameters.body = "=" + JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: { service: "common", method: "authenticate", args: ["{{ $vars.ODOO_SH_STAGING_DB }}", "{{ $vars.ODOO_SH_STAGING_USER }}", "{{ $vars.ODOO_SH_STAGING_KEY }}", {}] } });

  const search = clone(prodList, "Odoo Search Tickets");
  search.name = "Odoo Read Leads";
  search.position = [520, 300];
  search.parameters.url = STAGING_JSONRPC;
  search.parameters.body =
    "={{ JSON.stringify({ jsonrpc: '2.0', method: 'call', id: 2, params: { service: 'object', method: 'execute_kw', args: [" +
    "$vars.ODOO_SH_STAGING_DB, $('Odoo Authenticate').item.json.result, $vars.ODOO_SH_STAGING_KEY, 'crm.lead', 'search_read', " +
    "[[ ['id', 'in', ($('Webhook').item.json.body.lead_ids || []).map(Number).filter(Boolean).slice(0, 20)] ]], " +
    `{ fields: ${JSON.stringify(LEAD_FIELDS)}, limit: 20 }] } }) }}`;

  const respond = clone(prodList, "Respond to Webhook");
  respond.position = [780, 300];
  respond.parameters.responseBody = "={{ JSON.stringify($json.result ?? { error: $json.error?.data?.message ?? $json.error?.message ?? 'Odoo request failed' }) }}";

  return {
    name: "[STAGING] Portal Get My System → Odoo",
    nodes: [webhook, auth, search, respond],
    connections: {
      Webhook: { main: [[{ node: "Odoo Authenticate", type: "main", index: 0 }]] },
      "Odoo Authenticate": { main: [[{ node: "Odoo Read Leads", type: "main", index: 0 }]] },
      "Odoo Read Leads": { main: [[{ node: "Respond to Webhook", type: "main", index: 0 }]] },
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
await upsert(buildPmsList(prodList));
await upsert(buildPmsCreate(prodList));
await upsert(buildSystemDetails(prodList));
console.log(`\nwebhooks:\n  ${BASE}/webhook/staging/webflow-customer-support\n  ${BASE}/webhook/staging/get-my-tickets\n  ${BASE}/webhook/staging/get-my-pms\n  ${BASE}/webhook/staging/pms-request\n  ${BASE}/webhook/staging/get-my-system`);
