# Solviva Customer Portal (web)

Customer-facing web portal: solar savings and performance, support tickets, PMS requests and account
details. Built from the Figma mockup "Solviva App MVP 2026" and the *Web Portal User Stories V3* sheet.

React 19 + TypeScript + Vite 7 + Tailwind 4 + React Router 7 + Recharts, data from Supabase (RLS) and
the monitoring API; tickets through the existing n8n webhooks. See `docs/integrations.md` for what is
wired to what, and `Customer Portal - Development Plan 2026-10-08.md` for the plan and open questions.

## Run it

```
node scripts/sync-env.mjs   # copies the Supabase URL + anon key from solviva-inquiry/.env into .env.local
npm install
npm run dev                 # http://localhost:5173
```

Sign in with a portal login (a row in `auth.users` of the monitoring Supabase project with a matching
`user_profiles` row and a `solar_systems` row). There is no staging project yet: development runs against
production data, read-only except for your own profile edits.

`VITE_ENABLE_SUBMISSIONS` is `false` by default: the ticket and PMS forms validate and show the success
screen without posting anything to n8n/Odoo. Set it to `true` in `.env.local` to send real submissions.
`VITE_ENABLE_PMS` is also `false` by default (since 2026-11-05): the Support hub shows Request PMS as
"Coming soon", the PMS tab and pages are hidden and the PMS webhooks are never called. Set it to `true`
to work on the PMS flow.

Other scripts: `npm run typecheck`, `npm run build` (output in `dist/`), `npm run preview`,
`npm run build:production` / `npm run deploy:production` (see Environments).

## Layout

```
src/
  auth/AuthProvider.tsx      Supabase Auth session, sign-in/out, reset and change password
  lib/portal.tsx             profile + systems + providers + rates (PortalProvider / usePortal)
  lib/energy.ts              readings fetch + period aggregation (1D/1W/1M/1Y; 1Y = a calendar year by month, arrows to earlier years)
  lib/savings.ts             ₱ savings = bill without solar (total kWh at its consumption level) − bill with solar (grid kWh at its level) + exported kWh × the DU's net-metering rate; the current month uses last month's levels, a system without a full month the flat rate
  lib/api.ts                 monitoring API (/app/live, /app/hourly, /app/weather) with the user's JWT
  lib/tickets.ts             n8n ticket list / ticket + PMS intake
  lib/weather.ts             weather chip: the plant's Solis Cloud forecast via /app/weather (low–high, city, condition icon)
  layout/                    sidebar shell, breadcrumb
  pages/auth/                login, forgot password, reset password (Figma "Log in" frames, revised 2026-10-23), mandatory first-login "Create a new password"
  pages/home/                dashboard: hero savings, performance, battery, share/celebration
  pages/support/             hub + My activities, new ticket, ticket detail, contact, PMS intro + wizard
  pages/account/             profile, system details, FAQs, terms, privacy (documents tab hidden for now)
  content/                   contact details, FAQs (generated from the website: node scripts/sync-faqs.mjs), legal links
```

Design tokens live in `src/index.css` (`@theme`), taken from the Figma variables.

## Environments

**Demo (GitHub Pages):** https://solvivaenergy.github.io/customer-portal/ — every push to `main` rebuilds
and deploys it (`.github/workflows/pages.yml`). The build reads `VITE_SUPABASE_URL` from the repository
variables and `VITE_SUPABASE_ANON_KEY` from the repository secrets, calls the monitoring API and the n8n
webhooks directly (both allow the `solvivaenergy.github.io` origin), and ships with submissions disabled
unless the repository variable `VITE_ENABLE_SUBMISSIONS` is `true`. Deep links work through `404.html`.

For the password-reset email to land back on the demo, add
`https://solvivaenergy.github.io/customer-portal/reset-password` to Supabase → Authentication → URL
configuration → Redirect URLs (not done yet; the production URL below is).

**Production (the website's `/mysolviva` path):** https://www.solvivaenergy.com/mysolviva — since
2026-11-05 a Cloudflare Worker named `customer-portal` on Solviva's `solvivaenergy.com` zone, the same
way `/calculator`, `/pms` and `/prioritybooking` are served there. The Worker carries the Vite build as
static assets and maps `/mysolviva/*` onto it (`wrangler.toml`, `worker/index.js`); the apex host
redirects to `www`. Never put it on a `workers.dev` host: nothing else is configured for that origin.

- Build: `node scripts/build-production.mjs` — base path `/mysolviva/`, monitoring API
  `https://monitoring.solvivaenergy.com`, the **staging** n8n webhooks (no production portal workflows
  exist yet, see `docs/integrations.md`), submissions on, PMS off. The repository variables
  `VITE_N8N_WEBHOOK_URL_PRODUCTION`, `VITE_ENABLE_SUBMISSIONS_PRODUCTION` and `VITE_ENABLE_PMS_PRODUCTION`
  override those defaults in CI.
- Deploy: `.github/workflows/production.yml` runs on every push to `main` and deploys once the repository
  secret `CLOUDFLARE_API_TOKEN` exists (an API token with *Workers Scripts: Edit* and *Workers Routes:
  Edit* on the `solvivaenergy.com` zone; `CLOUDFLARE_ACCOUNT_ID` is already set). The shared token in
  `solviva-inquiry/.env` is read-only for Workers, so until then the workflow builds and warns instead of
  deploying. By hand: `npm run deploy:production` after `npx wrangler login`, or with
  `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` in the environment.
- Already wired for that origin: the monitoring API's `ALLOWED_ORIGINS` (`api/main.py` in the monitoring
  repo) and Supabase Auth's redirect allow-list (`https://www.solvivaenergy.com/mysolviva/**`, for the
  password-reset mail). The n8n webhooks answer any origin.

**Later:** a staging Supabase project; production copies of the portal n8n workflows that verify the
Supabase JWT (today the staging ones trust the email the browser sends).
