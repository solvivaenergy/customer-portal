import type { DailyReading, Rate } from "./types";
import { manilaDateKey, manilaToday } from "./format";

/** MERALCO is provider 1 in electricity_providers; used when a system has no provider. */
export const FALLBACK_PROVIDER_ID = 1;

/** kWh that picks each month's consumption level, keyed "YYYY-MM" (see tierBasis). */
export type TierBasis = Map<string, number>;

export type RateInfo = {
  rate: number; // ₱/kWh
  estimated: boolean; // no provider on the system, or a month before the first published rate
  tiered: boolean; // priced at a consumption level rather than the flat rate
};

/**
 * The schedule in force on a Manila date for a provider: the latest one whose effective_date is
 * on or before the day; before the first known schedule, the first one (marked estimated).
 */
function scheduleFor(rates: Rate[], providerId: number | null, dateKey: string): { schedule: Rate | null; estimated: boolean } {
  const pid = providerId ?? FALLBACK_PROVIDER_ID;
  let rows = rates.filter((r) => r.provider_id === pid);
  let estimated = providerId == null;
  if (!rows.length && pid !== FALLBACK_PROVIDER_ID) {
    rows = rates.filter((r) => r.provider_id === FALLBACK_PROVIDER_ID);
    estimated = true;
  }
  if (!rows.length) return { schedule: null, estimated: true };
  const sorted = [...rows].sort((a, b) => a.effective_date.localeCompare(b.effective_date));
  let chosen = sorted[0];
  let before = true;
  for (const r of sorted) {
    if (r.effective_date <= dateKey) {
      chosen = r;
      before = false;
    } else break;
  }
  return { schedule: chosen, estimated: estimated || before };
}

/**
 * ₱/kWh applicable on a Manila date. With a tiered schedule (MERALCO residential) and a tier basis
 * for the month, the rate of the smallest level at or above the month's kWh (the top level above
 * it) applies to every kWh of the month — the way MERALCO publishes it. Otherwise the flat rate.
 */
export function rateFor(rates: Rate[], providerId: number | null, dateKey: string, basis?: TierBasis): RateInfo {
  const { schedule, estimated } = scheduleFor(rates, providerId, dateKey);
  if (!schedule) return { rate: 0, estimated: true, tiered: false };
  const kwh = basis?.get(dateKey.slice(0, 7));
  if (schedule.tiers.length && kwh != null && kwh > 0) {
    const level = schedule.tiers.find((t) => t.consumption_kwh >= kwh) ?? schedule.tiers[schedule.tiers.length - 1];
    return { rate: Number(level.rate_per_kwh), estimated, tiered: true };
  }
  return { rate: Number(schedule.rate), estimated, tiered: false };
}

/**
 * The kWh that picks each month's consumption level: the month's total consumption (what the home
 * would have bought from the DU without solar); production when consumption is unknown; nothing
 * when the month has neither (the flat rate then applies). The current month is projected to a
 * full month from the month-to-date figure so the level does not reset to the cheapest on the 1st.
 */
export function tierBasis(rows: DailyReading[]): TierBasis {
  const consumption = new Map<string, number>();
  const production = new Map<string, number>();
  for (const r of rows) {
    const mk = manilaDateKey(r.timestamp).slice(0, 7);
    if (r.consumption_kwh != null) consumption.set(mk, (consumption.get(mk) ?? 0) + Number(r.consumption_kwh));
    if (r.production_kwh != null) production.set(mk, (production.get(mk) ?? 0) + Number(r.production_kwh));
  }
  const today = manilaDateKey(manilaToday());
  const thisMonth = today.slice(0, 7);
  const dayOfMonth = Number(today.slice(8, 10));
  const daysInMonth = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)).getUTCDate();
  const basis: TierBasis = new Map();
  for (const mk of new Set([...consumption.keys(), ...production.keys()])) {
    let kwh = consumption.get(mk) || production.get(mk) || 0;
    if (mk === thisMonth && dayOfMonth < daysInMonth) kwh = (kwh / dayOfMonth) * daysInMonth;
    if (kwh > 0) basis.set(mk, kwh);
  }
  return basis;
}
