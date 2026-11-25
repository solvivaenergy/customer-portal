/**
 * Microsoft Clarity: heat maps and session recordings of the portal (dashboard at clarity.microsoft.com,
 * project "Customer Portal").
 *
 * On only where the build names a project: scripts/build-production.mjs sets VITE_CLARITY_PROJECT_ID, so
 * the production site records and the demo and local development do not.
 *
 * What it may see: <body data-clarity-mask="true"> in index.html makes Clarity replace every text and
 * image with placeholders before anything leaves the browser, whatever masking mode the dashboard is on.
 * Names, addresses, kWh, pesos and ticket text never reach Microsoft; the layout, clicks and scrolling do.
 * To show a harmless label in recordings, put data-clarity-unmask="true" on that element.
 *
 * The hosts it loads from and posts to are listed in the Content-Security-Policy in worker/index.js.
 */
const projectId = import.meta.env.VITE_CLARITY_PROJECT_ID as string | undefined;

type ClarityQueue = { (...args: unknown[]): void; q?: IArguments[] };

let started = false;

/**
 * Loads Clarity once. Called by AuthProvider after Supabase has read the session, not at page load:
 * Clarity records the page address, and a password-recovery link arrives with the session tokens in the
 * address until Supabase has taken them out.
 */
export function startClarity() {
  if (started || !projectId) return;
  started = true;
  const w = window as unknown as { clarity?: ClarityQueue };
  // Same queue as Microsoft's snippet: calls made before the script arrives are replayed by it.
  if (!w.clarity) {
    const queue: ClarityQueue = function () {
      (queue.q = queue.q || []).push(arguments);
    };
    w.clarity = queue;
  }
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${projectId}`;
  document.head.appendChild(script);
}
