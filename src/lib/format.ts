import { format, formatDistanceToNowStrict } from "date-fns";

export const MANILA_TZ = "Asia/Manila";
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Date parts of an instant as seen in Manila. */
export function manilaParts(d: Date) {
  const shifted = new Date(d.getTime() + MANILA_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(), // 0-based
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(), // 0 = Sunday
  };
}

/** "YYYY-MM-DD" of an instant in Manila time. */
export function manilaDateKey(d: Date | string): string {
  const p = manilaParts(typeof d === "string" ? new Date(d) : d);
  return `${p.year}-${String(p.month + 1).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** The instant at which the given Manila calendar date starts (00:00 Manila). */
export function manilaMidnight(year: number, month0: number, day: number): Date {
  return new Date(Date.UTC(year, month0, day) - MANILA_OFFSET_MS);
}

/** Start of today in Manila, as an instant. */
export function manilaToday(): Date {
  const p = manilaParts(new Date());
  return manilaMidnight(p.year, p.month, p.day);
}

/** Make a Date from a Manila date key, pinned to noon Manila (safe for formatting). */
export function dateFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 4, 0, 0)); // 04:00Z = noon Manila
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

export const php = (value: number, opts: { decimals?: number } = {}) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: opts.decimals ?? 2,
    maximumFractionDigits: opts.decimals ?? 2,
  })
    .format(value)
    .replace("PHP", "₱")
    .replace(/ /g, "");

export const phpShort = (value: number) => {
  if (Math.abs(value) >= 1_000_000) return `₱${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `₱${Math.round(value / 1_000).toLocaleString()}k`;
  return `₱${Math.round(value).toLocaleString()}`;
};

export const kwh = (value: number, decimals = 0) =>
  `${value.toLocaleString("en-PH", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} kWh`;

export const num = (value: number, decimals = 0) =>
  value.toLocaleString("en-PH", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export const longDate = (d: Date | string) => format(typeof d === "string" ? new Date(d) : d, "MMMM d, yyyy");
export const shortDate = (d: Date | string) => format(typeof d === "string" ? new Date(d) : d, "MMM d, yyyy");
export const dateTime = (d: Date | string) => format(typeof d === "string" ? new Date(d) : d, "MMMM d, yyyy h:mm a");
export const relative = (d: Date | string) => formatDistanceToNowStrict(typeof d === "string" ? new Date(d) : d, { addSuffix: true });

export const initials = (name: string | null | undefined) =>
  (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "?";

export const firstName = (name: string | null | undefined) => (name ?? "").trim().split(/\s+/)[0] || "there";

export function greeting(): string {
  const h = manilaParts(new Date()).hour;
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** Strip HTML (Odoo descriptions are HTML). */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+\n/g, "\n").trim();
}

export function truncate(s: string, n = 60) {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}
