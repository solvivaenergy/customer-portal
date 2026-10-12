# Integrations — what the portal reads and writes (2026-10-08)

| Feature | Source today | Notes / what is still placeholder |
| --- | --- | --- |
| Login, reset password, change password | Supabase Auth (monitoring project) | Reset mail uses Supabase's default sender until custom SMTP (SES) is configured in Auth settings. Redirect URL `http://localhost:5173/reset-password` must be in Auth → URL configuration for the link to work in dev. |
| Profile | `user_profiles` (own row; RLS) | Editable: full name, phone, address. Email is the auth email. Odoo stays the system of record; edits are local to Supabase. |
| Systems / site selector | `solar_systems` (own + `system_access` grants; RLS) | Selector appears only when more than one system is visible. The monitoring API answers for the login's primary station only, so live data is used just for that site. |
| Daily history, 1W/1M/1Y/YTD | `energy_readings` (one row per day, noon-Manila timestamp) | Today's row is a zero placeholder until the 02:00 sync; the Home page patches today from `/app/live`, including `today_battery_discharge_kwh` (since 2026-10-09; before that today's Battery share was always 0.0). Past days' Battery = `battery_discharge_kwh`, Solis's settled day total. |
| 1D view | `/app/hourly` (today, live from the five-minute cache) / `energy_readings_hourly` (past days) | Battery share per hour = `battery_discharge_kwh`, integrated from the five-minute curve (monitoring migration 24, 2026-10-09). Hours stored before that date hold 0 until the fleet hourly re-read; the integrated day can differ from the daily table's Solis figure by a few kWh. |
| Battery card | `/app/live` + latest `energy_readings_five_minutes` row | Systems with no battery show a "No battery storage" card. |
| Savings (₱) | production kWh × `electricity_rates.rate` of the system's provider for that month | Flat monthly rate, no tiers (decision 2026-10-08). Months before the first known rate use the earliest rate; systems without a provider fall back to MERALCO and are marked "estimated". Legacy `daily_earning` (flat ₱14) is not used. |
| Referral code | `user_profiles.referral_code` (mirrored nightly from Odoo) | **Referral earnings = placeholder ₱0** ("Tracking coming soon"); no source exists in Odoo yet. Share link = website URL with `?ref=CODE`; no landing page yet. |
| Weather chip | Open-Meteo geocoding + forecast, city guessed from the site address | Hidden when the address cannot be geocoded. Swap for a chosen provider later. |
| My activities (tickets) | n8n `POST {VITE_N8N_WEBHOOK_URL}/get-my-tickets` `{email}` → Odoo `helpdesk.ticket` `search_read` on `partner_email` | **Staging** workflow (`…/webhook/staging`, see below) returns name, description, stage, priority, create_date, `ticket_ref`, `team_id`, `tag_ids`; the portal shows `#<ticket_ref>` and treats the "PMS" team/subject as a PMS request. The **production** workflow (`…/webhook`) returns no `ticket_ref` and, as of 2026-10-12, always answers `[]`: its "Odoo Authenticate" body lacks the `=` expression prefix, so the `{{ $vars }}` placeholders are sent literally and authentication fails (one-character fix in n8n). |
| Ticket status badge | Odoo stage name → New / In Progress / Resolved / Cancelled (keyword mapping in `lib/tickets.ts`) | Staging stages seen: "New". Confirm the full list with CX. |
| Submit a ticket | n8n `POST {VITE_N8N_WEBHOOK_URL}/webflow-customer-support` with the Webflow form field names and header `X-Submission-Source: customer-portal` (skips reCAPTCHA) → Odoo webhook creates the ticket | Technical vs general path chosen by the concern type (same list as the mobile app / website). Attachments not supported. Gated by `VITE_ENABLE_SUBMISSIONS`. The demo build and local dev use the **staging** workflow → odoo.sh staging; the production workflow also serves the website's forms and writes to production Odoo. |
| Request PMS | Same webhook, technical path, `Service-Type: "Schedule a PMS"`, wizard answers formatted into the description | **Interim**: Odoo gets a helpdesk ticket, not a maintenance/FSM record. Decide the target model with CX/After Sales. Gated by `VITE_ENABLE_SUBMISSIONS`. |

## Staging n8n workflows (created 2026-10-12)

`scripts/n8n/create-staging-workflows.mjs` creates or updates two workflows in the "Solviva n8n Projects"
team project, cloned from the production ones but aimed at the odoo.sh **staging** build
(`$vars.ODOO_SH_STAGING_URL`, `…_DB`, `…_USER`, `…_KEY`; the Odoo webhook path is reused from
`$vars.Ticket_Production_Technical_Odoo` because odoo.sh staging is a copy of production):

| Workflow | Webhook | Notes |
| --- | --- | --- |
| `[STAGING] Portal Support Intake → Odoo` | `POST https://solviva.app.n8n.cloud/webhook/staging/webflow-customer-support` | Webhook → Switch on `ticket-type` → HTTP POST to the staging Odoo hook (technical / general payloads as in production). No reCAPTCHA, no chained production call, failures return 500. |
| `[STAGING] Portal Get My Tickets → Odoo` | `POST https://solviva.app.n8n.cloud/webhook/staging/get-my-tickets` | JSON-RPC authenticate + `search_read` (`partner_email =ilike`), fields incl. `ticket_ref`/`team_id`/`tag_ids`; Odoo errors are returned as `{error}` instead of `[]`. |

The `Ticket_*` variables are **project-scoped**; a workflow created through the API lands in the key
owner's personal project where they resolve to `undefined`, so the script transfers each workflow into
the team project. Production workflows are only read by the script, never changed. The staging build
expires when odoo.sh rebuilds it; if that happens, update `ODOO_SH_STAGING_URL`/`_DB` in n8n and re-run
the script (no portal change needed).

Portal selection: repository variable `VITE_N8N_WEBHOOK_URL` = `…/webhook/staging` (demo) or
`…/webhook` (production); locally `VITE_N8N_WEBHOOK_URL=/api/n8n/staging` goes through the Vite proxy.
| Ticket thread / reply | — | Not available: the list workflow returns no `mail.message` rows and there is no reply endpoint. The detail page shows the ticket and a disabled reply box. |
| Notifications | — | No source; page is an empty state. |
| Documents | — | No source (Odoo attachments vs Drive undecided); tab shows "Not available in the portal yet". |
| FAQs, contact details, PMS copy, T&C, privacy | `src/content/*` | Placeholder/mockup copy; owners to confirm. T&C names "Solviva Energy, OPC". |

## Dev proxy

`vite.config.ts` proxies `/api/monitoring/*` → `https://monitoring.solvivaenergy.com` and `/api/n8n/*` →
`https://solviva.app.n8n.cloud/webhook` so the browser never hits CORS in development. The monitoring API
already allows `http://localhost:5173`, so the proxy is optional for it; n8n webhooks do not send CORS
headers for arbitrary origins, so the proxy (or a server-side relay) is required there.

## Before go-live (not done)

- Staging Supabase project + seed; Cloudflare Pages + DNS; `ALLOWED_ORIGINS` on the monitoring API.
- Supabase Auth: custom SMTP (SES), branded templates, Site URL and redirect URLs for the portal domains.
- Account clean-up and welcome-kit mailing (current logins are internal testers).
- n8n: return `ticket_ref`/`team_id`/`tag_ids`; a PMS intake that creates the agreed Odoo record; a reply endpoint if in-portal replies are wanted.
