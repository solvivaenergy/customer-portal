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
 *
 * /mysolviva/refer/<code> is the link the portal posts to Facebook (src/pages/home/share.tsx). A link
 * preview is built from the Open Graph tags of the posted URL, and the website's home page has one fixed
 * set whose canonical URL drops ?Referral=, so a post of the referral link itself shows the home page's
 * card and loses the code. This path answers preview crawlers with a card that names the code and sends
 * everyone else on to the referral link, https://www.solvivaenergy.com/?Referral=<code>.
 */
const PREFIX = "/mysolviva";
const CANONICAL_HOST = "www.solvivaenergy.com";
const ONE_YEAR = "public, max-age=31536000, immutable";
const REPORT_PATH = `${PREFIX}/csp-report`;
const REFER_PATH = `${PREFIX}/refer/`;

// Card wording from CX's share brief (2026-11-12). The code is the only variable part.
const SHARE_TITLE = "Switch to solar with Solviva";
const shareDescription = (code) => `Book your free solar consultation and site assessment. Referral code ${code}`;
// Facebook shows the description only on a card that has an image: without one the card is the title alone.
// The picture is CX's rooftop photo (2026-11-12), scaled from 1080px to 500px (public/brand/share-referral.jpg):
// under 600px wide Facebook keeps the thumbnail-beside-text card; at 600px or more it switches to its large
// layout, picture on top and cropped to a wide strip.
const SHARE_IMAGE = { url: `https://${CANONICAL_HOST}${PREFIX}/brand/share-referral.jpg`, size: 500, alt: "A home with Solviva solar panels on its roof" };
// Referral codes are the Odoo lead codes: letters (ñ included), digits and - . ( ). Anything else is not a
// code, so nobody can put their own wording on a solvivaenergy.com card.
const REFERRAL_CODE = /^[\p{L}\p{N}().-]{1,40}$/u;
// The programs that fetch a page to draw its preview card. They read the tags; they are not redirected.
const PREVIEW_CRAWLER = /facebookexternalhit|facebot|meta-externalagent|twitterbot|linkedinbot|whatsapp|viber|telegrambot|slackbot|discordbot|skypeuripreview/i;

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function referralShare(request, url) {
  const home = `https://${CANONICAL_HOST}/`;
  let code = "";
  try {
    code = decodeURIComponent(url.pathname.slice(REFER_PATH.length)).normalize("NFC");
  } catch {
    // Malformed escape: treated as no code.
  }
  if (!REFERRAL_CODE.test(code)) return Response.redirect(home, 302);
  const target = `${home}?Referral=${encodeURIComponent(code)}`;
  if (!PREVIEW_CRAWLER.test(request.headers.get("User-Agent") || "")) {
    return new Response(null, { status: 302, headers: { Location: target, "Cache-Control": "no-store", Vary: "User-Agent" } });
  }
  const self = `https://${CANONICAL_HOST}${REFER_PATH}${encodeURIComponent(code)}`;
  const description = escapeHtml(shareDescription(code));
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${SHARE_TITLE}</title>
<meta name="description" content="${description}">
<meta name="robots" content="noindex">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Solviva Energy">
<meta property="og:url" content="${self}">
<meta property="og:title" content="${SHARE_TITLE}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${SHARE_IMAGE.url}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="${SHARE_IMAGE.size}">
<meta property="og:image:height" content="${SHARE_IMAGE.size}">
<meta property="og:image:alt" content="${SHARE_IMAGE.alt}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${SHARE_TITLE}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${SHARE_IMAGE.url}">
</head>
<body>
<p><a href="${escapeHtml(target)}">${SHARE_TITLE}</a></p>
</body>
</html>`;
  return withSecurityHeaders(new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", Vary: "User-Agent" } }));
}

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

    if (url.pathname.startsWith(REFER_PATH)) return referralShare(request, url);

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
