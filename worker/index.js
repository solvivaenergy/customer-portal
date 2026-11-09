/**
 * Cloudflare Worker serving the portal at https://www.solvivaenergy.com/mysolviva (see wrangler.toml).
 *
 * The build in dist/ is made with BASE_PATH=/mysolviva/, so its HTML asks for /mysolviva/assets/… while
 * the files themselves sit at /assets/… in the asset store. Every request therefore has the prefix
 * stripped before it goes to the ASSETS binding; paths the store does not know come back as index.html
 * (not_found_handling = "single-page-application"), which is what React Router needs for deep links.
 *
 * Every response also carries the browser security headers the asset store does not set itself. The
 * Content-Security-Policy is report-only for now: nothing is blocked, violations are POSTed by the
 * browser to /mysolviva/csp-report and logged (Workers & Pages → customer-portal → Logs). Once real
 * traffic has produced no genuine violations, rename the header to Content-Security-Policy to enforce it.
 */
const PREFIX = "/mysolviva";
const CANONICAL_HOST = "www.solvivaenergy.com";
const ONE_YEAR = "public, max-age=31536000, immutable";
const REPORT_PATH = `${PREFIX}/csp-report`;

// Everything the app loads or calls: Google Fonts (index.html), Supabase (auth + realtime), the
// monitoring API (readings and the weather chip) and the n8n webhooks. 'unsafe-inline' for styles
// only: React and the chart library set inline style attributes.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://kzsocvzhbgtfyksrjmvk.supabase.co wss://kzsocvzhbgtfyksrjmvk.supabase.co" +
    " https://monitoring.solvivaenergy.com https://solviva.app.n8n.cloud",
  "worker-src 'self' blob:",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  `report-uri ${REPORT_PATH}`,
].join("; ");

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

function withSecurityHeaders(response, { cacheControl } = {}) {
  const secured = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) secured.headers.set(name, value);
  if ((secured.headers.get("Content-Type") || "").includes("text/html")) {
    secured.headers.set("Content-Security-Policy-Report-Only", CSP);
  }
  if (cacheControl) secured.headers.set("Cache-Control", cacheControl);
  return secured;
}

async function logCspReport(request) {
  let report = null;
  try {
    report = await request.json();
  } catch {
    // Not JSON: nothing useful to log.
  }
  const r = (report && report["csp-report"]) || report || {};
  console.log(
    "csp-report " +
      JSON.stringify({
        document: r["document-uri"],
        directive: r["effective-directive"] || r["violated-directive"],
        blocked: r["blocked-uri"],
        source: r["source-file"],
        line: r["line-number"],
        ua: request.headers.get("User-Agent"),
      }),
  );
  return new Response(null, { status: 204 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // The website already sends solvivaenergy.com to www; do the same here so the portal has one origin.
    if (url.hostname === "solvivaenergy.com") {
      url.hostname = CANONICAL_HOST;
      return Response.redirect(url.href, 301);
    }
    if (url.pathname === PREFIX) {
      url.pathname = `${PREFIX}/`;
      return Response.redirect(url.href, 301);
    }
    if (!url.pathname.startsWith(`${PREFIX}/`)) return new Response("Not found", { status: 404 });

    if (url.pathname === REPORT_PATH) {
      if (request.method !== "POST") return new Response("Not found", { status: 404 });
      return logCspReport(request);
    }

    url.pathname = url.pathname.slice(PREFIX.length);
    const response = await env.ASSETS.fetch(new Request(url.href, request));

    // Vite hashes everything under /assets/, so those can be cached for good; index.html keeps the
    // store's own revalidation headers so a new deploy shows up on the next load. A hashed file that
    // no longer exists (a tab opened before a deploy asking for an old chunk) must get a plain 404,
    // not the SPA fallback: that would be index.html cached for a year under a .js URL.
    const isAsset = url.pathname.startsWith("/assets/");
    if (isAsset && (response.headers.get("Content-Type") || "").includes("text/html")) {
      return withSecurityHeaders(new Response("Not found", { status: 404 }));
    }
    return withSecurityHeaders(response, { cacheControl: response.ok && isAsset ? ONE_YEAR : undefined });
  },
};
