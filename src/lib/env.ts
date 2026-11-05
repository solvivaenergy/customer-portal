const required = (name: string): string => {
  const v = import.meta.env[name] as string | undefined;
  if (!v) throw new Error(`Missing ${name}. Copy .env.example to .env.local or run: node scripts/sync-env.mjs`);
  return v;
};

/** Public asset URL honouring the build base path (GitHub Pages serves the app under /customer-portal/). */
export const asset = (p: string) => `${import.meta.env.BASE_URL}${p.replace(/^\//, "")}`;

/** Absolute URL of an in-app route, for auth redirects. */
export const appUrl = (route: string) => `${window.location.origin}${import.meta.env.BASE_URL}${route.replace(/^\//, "")}`;

export const env = {
  supabaseUrl: required("VITE_SUPABASE_URL"),
  supabaseAnonKey: required("VITE_SUPABASE_ANON_KEY"),
  monitoringApiUrl: (import.meta.env.VITE_MONITORING_API_URL as string | undefined) ?? "/api/monitoring",
  n8nWebhookUrl: (import.meta.env.VITE_N8N_WEBHOOK_URL as string | undefined) ?? "/api/n8n",
  /** When false, Support forms succeed locally without posting to n8n/Odoo. */
  submissionsEnabled: (import.meta.env.VITE_ENABLE_SUBMISSIONS as string | undefined) === "true",
  /**
   * Request PMS (intro, wizard, PMS tab under My activities, /support/pms routes). Off since 2026-11-05:
   * the Support hub shows the card as "Coming soon" and the PMS webhooks are never called.
   */
  pmsEnabled: (import.meta.env.VITE_ENABLE_PMS as string | undefined) === "true",
};
