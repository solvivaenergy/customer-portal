/**
 * Creates (or updates) the n8n workflows behind everything the portal reads from or writes to Odoo,
 * for one Odoo build at a time:
 *
 *   node scripts/n8n/create-portal-workflows.mjs                     odoo.sh STAGING (default)
 *   node scripts/n8n/create-portal-workflows.mjs --env production    odoo.sh PRODUCTION
 *   … --dry-run                                                      print the definitions, write nothing
 *
 *   staging      "[STAGING] Portal … → Odoo"   POST /webhook/staging/<path>   demo site, local development
 *   production   "[PROD] Portal … → Odoo"      POST /webhook/portal/<path>    www.solvivaenergy.com/mysolviva
 *
 *   Support Intake    webflow-customer-support   helpdesk.ticket through Odoo's own webhook
 *   Get My Tickets    get-my-tickets             helpdesk.ticket + tag names
 *   Get My System     get-my-system              crm.lead (equipment, sales rep)
 *   Ticket Messages   get-ticket-messages        mail.message, customer-visible only
 *   Ticket Reply      ticket-reply               helpdesk.ticket message_post
 *   Get My PMS        get-my-pms                 maintenance.request            (staging only)
 *   PMS Request       pms-request                maintenance.request create     (staging only)
 *
 * The two PMS workflows are not built for production: Request PMS is switched off in the portal
 * (VITE_ENABLE_PMS) until the intake is agreed, and a webhook that creates maintenance requests in
 * production Odoo should not exist before then.
 *
 * Environment values come from n8n variables at run time (nothing is hard-coded here):
 *   ODOO_SH_STAGING_URL / _DB / _USER / _KEY          staging host + JSON-RPC credentials
 *   ODOO_SH_PROD_URL / _DB / _USER / _KEY             production host + JSON-RPC credentials
 *   Ticket_Production_Technical_Odoo / _General_Odoo  production's ticket webhook, used as is for
 *                                                     production; staging reuses only its PATH on
 *                                                     the staging host (odoo.sh staging is a copy
 *                                                     of production, so the UUID is the same).
 *
 * The nodes are cloned from two workflows the website and the mobile app already use ("Webflow
 * Customer Support to CRM", "Get My Tickets - Odoo Proxy"). Those are only READ, never modified.
 * Needs N8N_URL and N8N_API_KEY in solviva-inquiry/.env.
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

const TARGETS = {
  staging: { tag: "[STAGING]", path: "staging", label: "Staging", vars: "ODOO_SH_STAGING", pms: true },
  production: { tag: "[PROD]", path: "portal", label: "Production", vars: "ODOO_SH_PROD", pms: false },
};
const flag = (name) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const TARGET = flag("--env") || "staging";
const DRY_RUN = process.argv.includes("--dry-run");
const T = TARGETS[TARGET];
if (!T) throw new Error(`--env must be one of: ${Object.keys(TARGETS).join(", ")}`);

/** The n8n variables holding this build's JSON-RPC credentials, as they are written inside an expression. */
const V = { url: `$vars.${T.vars}_URL`, db: `$vars.${T.vars}_DB`, user: `$vars.${T.vars}_USER`, key: `$vars.${T.vars}_KEY` };
const workflowName = (what) => `${T.tag} Portal ${what} → Odoo`;
const hookPath = (name) => `${T.path}/${name}`;

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
  // Drop ids and the source's continue-on-fail flags: a failed Odoo call must fail the run
  // (the webhook then answers 500 and the portal shows an error) instead of returning an error item.
  const { id: _id, webhookId: _w, onError: _e, continueOnFail: _c, ...rest } = structuredClone(n);
  return rest;
};
/** Rewrite every $('Some Node') reference inside a node's parameters to the given node name. */
const retarget = (node, to) => {
  node.parameters = JSON.parse(JSON.stringify(node.parameters).replace(/\$\('[^']+'\)/g, `$('${to}')`));
  return node;
};
/** Connections for nodes that simply run one after the other. */
const chain = (...names) => Object.fromEntries(names.slice(0, -1).map((n, i) => [n, { main: [[{ node: names[i + 1], type: "main", index: 0 }]] }]));

/* ------------------------------------------------------------------ Where Odoo is */

// Odoo's ticket webhook. Production: the two variables the website's own intake posts to. Staging:
// the staging host + the production hook's path (same UUID on both builds).
// (Kept regex-free apart from the trailing-slash trim: n8n's expression parser mis-reads "/" inside a character class.)
const STAGING_HOOK = String.raw`={{ $vars.ODOO_SH_STAGING_URL.replace(/\/+$/, '') + '/web/hook/' + $vars.Ticket_Production_Technical_Odoo.split('/web/hook/')[1] }}`;
const TICKET_HOOK =
  TARGET === "production"
    ? { technical: "={{ $vars.Ticket_Production_Technical_Odoo }}", general: "={{ $vars.Ticket_Production_General_Odoo }}" }
    : { technical: STAGING_HOOK, general: STAGING_HOOK };
const JSONRPC = String.raw`={{ ${V.url}.replace(/\/+$/, '') + '/jsonrpc' }}`;

// The source node's body lacks the "=" prefix, so its {{ $vars }} are sent literally. Fixed here.
const AUTH_BODY =
  "=" +
  JSON.stringify({
    jsonrpc: "2.0",
    method: "call",
    id: 1,
    params: { service: "common", method: "authenticate", args: [`{{ ${V.db} }}`, `{{ ${V.user} }}`, `{{ ${V.key} }}`, {}] },
  });

/** Body of one execute_kw call; `rest` is the expression text for the positional args and kwargs. */
const rpc = (id, model, method, rest) =>
  `={{ JSON.stringify({ jsonrpc: '2.0', method: 'call', id: ${id}, params: { service: 'object', method: 'execute_kw', args: [` +
  `${V.db}, $('Odoo Authenticate').item.json.result, ${V.key}, '${model}', '${method}', ${rest}] } }) }}`;

const webhookNode = (prodList, path) => {
  const webhook = clone(prodList, "Webhook");
  webhook.position = [0, 300];
  webhook.parameters = { ...webhook.parameters, httpMethod: "POST", path: hookPath(path), responseMode: "responseNode" };
  return webhook;
};

const authNode = (prodList) => {
  const auth = clone(prodList, "Odoo Authenticate");
  auth.position = [260, 300];
  auth.parameters.url = JSONRPC;
  auth.parameters.body = AUTH_BODY;
  return auth;
};

/** One JSON-RPC call to Odoo, shaped like the source workflow's "Odoo Search Tickets" node. */
const odooNode = (prodList, name, position, body) => {
  const node = clone(prodList, "Odoo Search Tickets");
  node.name = name;
  node.position = position;
  node.parameters.url = JSONRPC;
  node.parameters.body = body;
  return node;
};

// Odoo errors are surfaced instead of silently answering [] (the portal shows them).
const RESULT_OR_ERROR = "={{ JSON.stringify($json.result ?? { error: $json.error?.data?.message ?? $json.error?.message ?? 'Odoo request failed' }) }}";
const ID_OR_ERROR = "={{ JSON.stringify(typeof $json.result === 'number' ? { id: $json.result } : { error: $json.error?.data?.message ?? $json.error?.message ?? 'Odoo request failed' }) }}";
const respondNode = (prodList, position, responseBody = RESULT_OR_ERROR) => {
  const respond = clone(prodList, "Respond to Webhook");
  respond.position = position;
  respond.parameters.responseBody = responseBody;
  return respond;
};

/* ------------------------------------------------------------------ Submit a ticket */

function buildIntake(prod) {
  const webhook = clone(prod, "Webhook from Solviva Site");
  webhook.name = "Webhook";
  webhook.position = [0, 300];
  webhook.parameters = { ...webhook.parameters, httpMethod: "POST", path: hookPath("webflow-customer-support"), responseMode: "lastNode" };

  const sw = retarget(clone(prod, "Technical or General?1"), "Webhook");
  sw.name = "Technical or General?";
  sw.position = [260, 300];

  const tech = retarget(clone(prod, "POST Technical to Odoo Prod"), "Webhook");
  tech.name = `POST Technical to Odoo ${T.label}`;
  tech.position = [560, 180];
  tech.parameters.url = TICKET_HOOK.technical;

  const gen = retarget(clone(prod, "POST General to Odoo prod"), "Webhook");
  gen.name = `POST General to Odoo ${T.label}`;
  gen.position = [560, 420];
  gen.parameters.url = TICKET_HOOK.general;

  return {
    name: workflowName("Support Intake"),
    nodes: [webhook, sw, tech, gen],
    connections: {
      Webhook: { main: [[{ node: "Technical or General?", type: "main", index: 0 }]] },
      "Technical or General?": {
        main: [
          [{ node: tech.name, type: "main", index: 0 }],
          [{ node: gen.name, type: "main", index: 0 }],
        ],
      },
    },
    settings: { executionOrder: "v1" },
  };
}

/* ------------------------------------------------------------ Who owns a ticket (ids first, email second) */

/**
 * The portal sends `{ email, partner_id, lead_ids }` (lib/portal.tsx odooIdentity). The customer's
 * Odoo partner ids are the profile's partner plus the partner on each of their plants' leads — a
 * customer with several properties can have several partner records (three for Amparo Dionisio).
 * Since 2026-11-09 a ticket is theirs when its partner_id is one of those, OR its partner_email is
 * the customer's Odoo email (the fallback for tickets filed from the website form, which Odoo
 * matches by email). The login email plays no part: it is the Solis Cloud address.
 */
const leadPartnersNode = (prodList) =>
  odooNode(
    prodList,
    "Odoo Read Lead Partners",
    [520, 300],
    rpc(5, "crm.lead", "search_read", "[[ ['id', 'in', ($('Webhook').item.json.body.lead_ids || []).map(Number).filter(Boolean).slice(0, 20)] ]], { fields: ['id', 'partner_id'], limit: 20 }"),
  );
// Expression (inside {{ }}): every partner id the request resolves to.
const PARTNER_IDS =
  "[Number($('Webhook').item.json.body.partner_id) || 0].concat((Array.isArray($('Odoo Read Lead Partners').item.json.result) ? $('Odoo Read Lead Partners').item.json.result : []).map((l) => Array.isArray(l.partner_id) ? l.partner_id[0] : 0)).filter(Boolean)";
// Domain fragment: the ticket belongs to the customer. Substring match on the email because Odoo
// often stores partner_email as "Name" <email>; '__no_email__' keeps an empty email from matching all.
const OWNER_DOMAIN = `'|', ['partner_id', 'in', ${PARTNER_IDS}], ['partner_email', 'ilike', $('Webhook').item.json.body.email || '__no_email__']`;

function buildList(prod) {
  const SOURCE_DOMAIN = "[[ ['partner_email', '=', $('Webhook').item.json.body.email] ]]";
  const search = clone(prod, "Odoo Search Tickets");
  search.position = [780, 300];
  search.parameters.url = JSONRPC;
  if (!String(search.parameters.body).includes(SOURCE_DOMAIN)) throw new Error("The source 'Odoo Search Tickets' domain changed — update SOURCE_DOMAIN in buildList");
  search.parameters.body = String(search.parameters.body)
    .replace(/\$vars\.ODOO_SH_PROD_DB/g, V.db)
    .replace(/\$vars\.ODOO_API_KEY/g, V.key)
    .replace(SOURCE_DOMAIN, `[[ ${OWNER_DOMAIN} ]]`)
    .replace("'partner_name'", "'partner_name', 'ticket_ref', 'team_id', 'tag_ids'");

  // tag_ids come back as ids; read the names (helpdesk.tag) and attach them as `tags` — the
  // portal's "Category" column is the first tag.
  const tags = odooNode(
    prod,
    "Odoo Read Tags",
    [1040, 300],
    rpc(
      3,
      "helpdesk.tag",
      "search_read",
      "[[ ['id', 'in', (Array.isArray($('Odoo Search Tickets').item.json.result) ? $('Odoo Search Tickets').item.json.result : []).reduce((a, t) => a.concat(t.tag_ids || []), []).filter((v, i, arr) => arr.indexOf(v) === i)] ]], { fields: ['id', 'name'], limit: 200 }",
    ),
  );

  const attach = {
    name: "Attach tag names",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [1300, 300],
    parameters: {
      mode: "runOnceForAllItems",
      jsCode: String.raw`const search = $('Odoo Search Tickets').first().json;
if (!Array.isArray(search.result)) return [{ json: { error: search.error } }];
const names = new Map((($input.first().json.result) || []).map((t) => [t.id, t.name]));
return [{ json: { result: search.result.map((t) => ({ ...t, tags: (t.tag_ids || []).map((id) => names.get(id)).filter(Boolean) })) } }];`,
    },
  };

  return {
    name: workflowName("Get My Tickets"),
    nodes: [webhookNode(prod, "get-my-tickets"), authNode(prod), leadPartnersNode(prod), search, tags, attach, respondNode(prod, [1560, 300])],
    connections: chain("Webhook", "Odoo Authenticate", "Odoo Read Lead Partners", "Odoo Search Tickets", "Odoo Read Tags", "Attach tag names", "Respond to Webhook"),
    settings: { executionOrder: "v1" },
  };
}

/* ------------------------------------------------------------ Ticket chatter (mail.message) */

/** The ticket named in the request, only if it is the customer's (OWNER_DOMAIN) — the ownership check both chatter workflows start with. */
const checkTicketNode = (prodList) =>
  odooNode(
    prodList,
    "Odoo Check Ticket",
    [780, 300],
    rpc(2, "helpdesk.ticket", "search_read", `[[ ['id', '=', Number($('Webhook').item.json.body.ticket_id) || -1], ${OWNER_DOMAIN} ]], { fields: ['id', 'partner_id', 'partner_email'], limit: 1 }`),
  );

const MESSAGE_FIELDS = ["id", "body", "author_id", "email_from", "date", "message_type", "subtype_id"];

/**
 * Customer-visible chatter of one of the customer's tickets: comments and emails whose subtype is
 * not internal (internal notes stay in Odoo). Newest first.
 */
function buildTicketMessages(prodList) {
  const read = odooNode(
    prodList,
    "Odoo Read Messages",
    [1040, 300],
    rpc(
      3,
      "mail.message",
      "search_read",
      "[[ ['model', '=', 'helpdesk.ticket'], ['res_id', 'in', (Array.isArray($('Odoo Check Ticket').item.json.result) ? $('Odoo Check Ticket').item.json.result : []).map((t) => t.id)], " +
        "['message_type', 'in', ['comment', 'email']], ['is_internal', '=', false], ['subtype_id.internal', '=', false] ]], " +
        `{ fields: ${JSON.stringify(MESSAGE_FIELDS)}, limit: 100, order: 'date desc' }`,
    ),
  );

  return {
    name: workflowName("Ticket Messages"),
    nodes: [webhookNode(prodList, "get-ticket-messages"), authNode(prodList), leadPartnersNode(prodList), checkTicketNode(prodList), read, respondNode(prodList, [1300, 300])],
    connections: chain("Webhook", "Odoo Authenticate", "Odoo Read Lead Partners", "Odoo Check Ticket", "Odoo Read Messages", "Respond to Webhook"),
    settings: { executionOrder: "v1" },
  };
}

/**
 * Posts the customer's reply on the ticket's chatter (message_post, subtype Discussions) as the
 * ticket's own partner, so the support team sees it where they work and followers are notified
 * the way they are for an emailed reply.
 */
function buildTicketReply(prodList) {
  const build = {
    name: "Build reply",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [1040, 300],
    parameters: {
      mode: "runOnceForAllItems",
      jsCode: String.raw`const b = $('Webhook').first().json.body || {};
const found = (($('Odoo Check Ticket').first().json.result) || [])[0];
if (!found) throw new Error('Ticket not found for this customer');
const text = String(b.body || '').trim();
if (!text) throw new Error('The reply is empty');
if (text.length > 5000) throw new Error('The reply is too long (5000 characters at most)');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const html = '<p>' + esc(text).replace(/\r?\n/g, '<br>') + '</p>';
// body_is_html: without it Odoo escapes the string a second time and the tags show as text.
const kwargs = { body: html, body_is_html: true, message_type: 'comment', subtype_xmlid: 'mail.mt_comment' };
if (found.partner_id) kwargs.author_id = found.partner_id[0];
return [{ json: { ticket_id: found.id, kwargs } }];`,
    },
  };

  const post = odooNode(prodList, "Odoo Post Reply", [1300, 300], rpc(4, "helpdesk.ticket", "message_post", "[[$json.ticket_id]], $json.kwargs"));

  return {
    name: workflowName("Ticket Reply"),
    nodes: [webhookNode(prodList, "ticket-reply"), authNode(prodList), leadPartnersNode(prodList), checkTicketNode(prodList), build, post, respondNode(prodList, [1560, 300], ID_OR_ERROR)],
    connections: chain("Webhook", "Odoo Authenticate", "Odoo Read Lead Partners", "Odoo Check Ticket", "Build reply", "Odoo Post Reply", "Respond to Webhook"),
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
  const search = odooNode(
    prodList,
    "Odoo Search PMS Requests",
    [520, 300],
    rpc(
      2,
      "maintenance.request",
      "search_read",
      "[[ '|', '|', ['x_pms_email', 'ilike', $('Webhook').item.json.body.email || '__no_email__'], " +
        "['x_pms_partner_id', '=', Number($('Webhook').item.json.body.partner_id) || -1], " +
        "['x_pms_crm_lead_id', 'in', ($('Webhook').item.json.body.lead_ids || []).map(Number).filter(Boolean)] ]], " +
        `{ fields: ${JSON.stringify(PMS_FIELDS)}, limit: 50, order: 'create_date desc' }`,
    ),
  );

  return {
    name: workflowName("Get My PMS"),
    nodes: [webhookNode(prodList, "get-my-pms"), authNode(prodList), search, respondNode(prodList, [780, 300])],
    connections: chain("Webhook", "Odoo Authenticate", "Odoo Search PMS Requests", "Respond to Webhook"),
    settings: { executionOrder: "v1" },
  };
}

/** Creates a maintenance.request from the portal's PMS wizard, with the questionnaire app's field mapping. */
function buildPmsCreate(prodList) {
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

  const create = odooNode(prodList, "Odoo Create PMS Request", [780, 300], rpc(3, "maintenance.request", "create", "[$json.vals]"));

  return {
    name: workflowName("PMS Request"),
    nodes: [webhookNode(prodList, "pms-request"), authNode(prodList), map, create, respondNode(prodList, [1040, 300], ID_OR_ERROR)],
    connections: chain("Webhook", "Odoo Authenticate", "Build maintenance.request values", "Odoo Create PMS Request", "Respond to Webhook"),
    settings: { executionOrder: "v1" },
  };
}

/* ------------------------------------------------------- System details (crm.lead, read-only) */

const LEAD_FIELDS = [
  "id", "name", "x_studio_crm_design_solis_station_id", "x_studio_crm_contract_system_size_kwp", "x_studio_system_size_kwp",
  "x_studio_crm_brand_battery", "x_studio_crm_model_battery", "x_studio_crm_quantity_battery", "x_studio_crm_size_per_unit_kwh_battery",
  "x_studio_crm_brand_inverter", "x_studio_crm_model_inverter", "x_studio_crm_quantity_inverter", "x_studio_crm_size_per_unit_kw_inverter",
  "user_id",
];

/**
 * Battery / inverter / sales rep for the login's own CRM leads (the nightly mirror does not copy these yet).
 * The installed and energization dates are mirrored into solar_systems (monitoring migration 31), not read here.
 */
function buildSystemDetails(prodList) {
  const search = odooNode(
    prodList,
    "Odoo Read Leads",
    [520, 300],
    rpc(2, "crm.lead", "search_read", `[[ ['id', 'in', ($('Webhook').item.json.body.lead_ids || []).map(Number).filter(Boolean).slice(0, 20)] ]], { fields: ${JSON.stringify(LEAD_FIELDS)}, limit: 20 }`),
  );

  return {
    name: workflowName("Get My System"),
    nodes: [webhookNode(prodList, "get-my-system"), authNode(prodList), search, respondNode(prodList, [780, 300])],
    connections: chain("Webhook", "Odoo Authenticate", "Odoo Read Leads", "Respond to Webhook"),
    settings: { executionOrder: "v1" },
  };
}

/* ------------------------------------------------------------------ Create / update in n8n */

// Team project that owns the source workflows AND the project-scoped Ticket_* variables.
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
const definitions = [
  buildIntake(prodIntake),
  buildList(prodList),
  ...(T.pms ? [buildPmsList(prodList), buildPmsCreate(prodList)] : []),
  buildSystemDetails(prodList),
  buildTicketMessages(prodList),
  buildTicketReply(prodList),
];

if (DRY_RUN) {
  console.log(JSON.stringify(definitions, null, 1));
} else {
  for (const def of definitions) await upsert(def);
  const paths = definitions.map((d) => d.nodes.find((n) => n.name === "Webhook").parameters.path);
  console.log(`\n${TARGET} webhooks (portal: VITE_N8N_WEBHOOK_URL=${BASE}/webhook/${T.path}):\n${paths.map((p) => `  ${BASE}/webhook/${p}`).join("\n")}`);
}
