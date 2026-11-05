/**
 * Cloudflare Worker serving the portal at https://www.solvivaenergy.com/mysolviva (see wrangler.toml).
 *
 * The build in dist/ is made with BASE_PATH=/mysolviva/, so its HTML asks for /mysolviva/assets/… while
 * the files themselves sit at /assets/… in the asset store. Every request therefore has the prefix
 * stripped before it goes to the ASSETS binding; paths the store does not know come back as index.html
 * (not_found_handling = "single-page-application"), which is what React Router needs for deep links.
 */
const PREFIX = "/mysolviva";
const CANONICAL_HOST = "www.solvivaenergy.com";
const ONE_YEAR = "public, max-age=31536000, immutable";

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

    url.pathname = url.pathname.slice(PREFIX.length);
    const response = await env.ASSETS.fetch(new Request(url.href, request));

    // Vite hashes everything under /assets/, so those can be cached for good; index.html keeps the
    // store's own revalidation headers so a new deploy shows up on the next load.
    if (response.ok && url.pathname.startsWith("/assets/")) {
      const cached = new Response(response.body, response);
      cached.headers.set("Cache-Control", ONE_YEAR);
      return cached;
    }
    return response;
  },
};
