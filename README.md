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

Other scripts: `npm run typecheck`, `npm run build` (output in `dist/`), `npm run preview`.

## Layout

```
src/
  auth/AuthProvider.tsx      Supabase Auth session, sign-in/out, reset and change password
  lib/portal.tsx             profile + systems + providers + rates (PortalProvider / usePortal)
  lib/energy.ts              readings fetch + period aggregation (1D/1W/1M/1Y/YTD)
  lib/savings.ts             ₱ savings = kWh × provider rate for that month (flat, no tiers)
  lib/api.ts                 monitoring API (/app/live, /app/hourly) with the user's JWT
  lib/tickets.ts             n8n ticket list / ticket + PMS intake
  lib/weather.ts             Open-Meteo chip (city guessed from the site address)
  layout/                    sidebar shell, breadcrumb
  pages/auth/                login, forgot password, reset password (improvised; not in the mockup)
  pages/home/                dashboard: hero savings, performance, battery, share/celebration
  pages/support/             hub + My activities, new ticket, ticket detail, contact, PMS intro + wizard
  pages/account/             profile, system details, documents, FAQs, terms, privacy
  content/                   contact details, FAQs, legal text (copy owners: CX / Marketing / Legal)
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
configuration → Redirect URLs.

**Later:** a staging Supabase project, a Solviva subdomain (Cloudflare Pages), and the monitoring API's
`ALLOWED_ORIGINS` extended with that origin.
