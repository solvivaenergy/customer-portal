import type { Rate } from "./types";

/** MERALCO is provider 1 in electricity_providers; used when a system has no provider. */
export const FALLBACK_PROVIDER_ID = 1;

/**
 * Rate (₱/kWh) applicable on a Manila date for a provider: the latest rate whose
 * effective_date is on or before the day; before the first known rate, the first rate.
 * Flat monthly rates only — no consumption tiers (decision 2026-10-08).
 */
export function rateFor(rates: Rate[], providerId: number | null, dateKey: string): { rate: number; estimated: boolean } {
  const pid = providerId ?? FALLBACK_PROVIDER_ID;
  let rows = rates.filter((r) => r.provider_id === pid);
  let estimated = providerId == null;
  if (!rows.length && pid !== FALLBACK_PROVIDER_ID) {
    rows = rates.filter((r) => r.provider_id === FALLBACK_PROVIDER_ID);
    estimated = true;
  }
  if (!rows.length) return { rate: 0, estimated: true };
  const sorted = [...rows].sort((a, b) => a.effective_date.localeCompare(b.effective_date));
  let chosen = sorted[0];
  let before = true;
  for (const r of sorted) {
    if (r.effective_date <= dateKey) {
      chosen = r;
      before = false;
    } else break;
  }
  return { rate: Number(chosen.rate), estimated: estimated || before };
}

export const currentRate = (rates: Rate[], providerId: number | null) =>
  rateFor(rates, providerId, new Date().toISOString().slice(0, 10));
