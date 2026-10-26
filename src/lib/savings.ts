import type { DailyReading, Rate } from "./types";
import { manilaDateKey, manilaToday } from "./format";

/** MERALCO is provider 1 in electricity_providers; used when a system has no provider. */
export const FALLBACK_PROVIDER_ID = 1;

/** Days with data a month needs before its own consumption sets the levels. */
export const FULL_MONTH_DAYS = 25;

/**
 * A month's kWh that pick its consumption levels: `total` (what the home used: the bill without
 * solar) and `grid` (what it bought: the bill with solar), plus the days with data. When a month has
 * no consumption at all (no meter), `total` is its production and `hasConsumption` is false.
 */
export type MonthBasis = { total: number; grid: number; days: number; hasConsumption: boolean };
/** Keyed "YYYY-MM". */
export type TierBasis = Map<string, MonthBasis>;

export type RateInfo = {
  rateTotal: number; // ₱/kWh that prices the bill without solar: the level of the month's total consumption, or the flat rate
  rateGrid: number; // ₱/kWh that prices the bill with solar: the level of the month's grid import, or the flat rate
  rateExport: number; // ₱/kWh credited per exported kWh: the DU's net-metering rate (0 when none is known)
  estimated: boolean; // no provider on the system, or a month before the first published rate
  exportEstimated: boolean; // the DU has no net-metering rate, so MERALCO's is used for export
  tiered: boolean; // priced at consumption levels rather than the flat rate
  flat: boolean; // a tiered schedule priced at its flat rate because no full month sets the levels yet
  basisMonth: string | null; // "YYYY-MM" whose kWh set the levels (the previous month for the current month)
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

/** The rate of the smallest level at or above `kwh` (above the top level, the top level) — the way MERALCO bills: every kWh of the month at that level's rate. */
function levelRate(schedule: Rate, kwh: number): number {
  const level = schedule.tiers.find((t) => t.consumption_kwh >= kwh) ?? schedule.tiers[schedule.tiers.length - 1];
  return Number(level.rate_per_kwh);
}

const prevMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};

/**
 * Which month's kWh set a month's levels: a finished month uses its own when it has a full month
 * of data, else the month before it; the current month always uses the month before it (its own
 * total is not known yet). Nothing when neither has a full month: the flat rate then applies, so
 * a newly energized system is priced at the flat rate until its first full month.
 */
function basisFor(basis: TierBasis | undefined, month: string, currentMonth: string): { mb: MonthBasis | null; basisMonth: string | null } {
  if (!basis) return { mb: null, basisMonth: null };
  const full = (k: string) => {
    const b = basis.get(k);
    return b && b.days >= FULL_MONTH_DAYS ? b : null;
  };
  const prev = prevMonth(month);
  if (month < currentMonth) {
    const own = full(month);
    if (own) return { mb: own, basisMonth: month };
  }
  const p = full(prev);
  return { mb: p, basisMonth: p ? prev : null };
}

/**
 * ₱/kWh applicable on a Manila date. With a tiered schedule (MERALCO residential) and a month that
 * sets the levels (see basisFor), the bill without solar is priced at the level of that month's
 * total consumption and the bill with solar at the level of its grid import. Otherwise the flat
 * rate prices both. Exported kWh are credited at the schedule's net-metering rate (MERALCO's blended
 * generation cost excluding adjustments, one figure per month); a DU without one uses MERALCO's.
 */
export function rateFor(rates: Rate[], providerId: number | null, dateKey: string, basis?: TierBasis): RateInfo {
  const { schedule, estimated } = scheduleFor(rates, providerId, dateKey);
  if (!schedule) return { rateTotal: 0, rateGrid: 0, rateExport: 0, estimated: true, exportEstimated: false, tiered: false, flat: false, basisMonth: null };
  const currentMonth = manilaDateKey(manilaToday()).slice(0, 7);
  const { mb, basisMonth } = basisFor(basis, dateKey.slice(0, 7), currentMonth);
  let rateTotal = Number(schedule.rate);
  let rateGrid = rateTotal;
  let tiered = false;
  let flat = false;
  if (schedule.tiers.length) {
    if (mb) {
      rateTotal = levelRate(schedule, mb.total);
      rateGrid = levelRate(schedule, mb.grid);
      tiered = true;
    } else flat = true;
  }
  let rateExport = 0;
  let exportEstimated = false;
  if (schedule.net_metering_rate != null) rateExport = Number(schedule.net_metering_rate);
  else {
    const meralco = scheduleFor(rates, FALLBACK_PROVIDER_ID, dateKey).schedule;
    if (meralco?.net_metering_rate != null) {
      rateExport = Number(meralco.net_metering_rate);
      exportEstimated = true;
    }
  }
  return { rateTotal, rateGrid, rateExport, estimated, exportEstimated, tiered, flat, basisMonth };
}

export type EnergyFigures = { production: number; consumption: number | null; grid: number; exported: number };

/**
 * ₱ saved over a day, an hour or a month: the bill without solar (what the home used, at the level
 * that total sets) minus the bill with solar (what it bought from the grid, at the level that
 * import sets), never below zero, plus the exported kWh at the net-metering rate. A period with no
 * consumption figure (no meter) falls back to production × the "without solar" rate.
 */
export function savingsFor(f: EnergyFigures, info: RateInfo): number {
  if (f.consumption == null) return f.production * info.rateTotal;
  const billDifference = Math.max(f.consumption * info.rateTotal - f.grid * info.rateGrid, 0);
  return billDifference + f.exported * info.rateExport;
}

/**
 * Each month's kWh for basisFor, from the daily history: total consumption (production when the
 * month has no consumption at all), grid import, and the days with data.
 */
export function tierBasis(rows: DailyReading[]): TierBasis {
  const acc = new Map<string, { consumption: number; production: number; grid: number; days: number; consumptionDays: number }>();
  for (const r of rows) {
    const mk = manilaDateKey(r.timestamp).slice(0, 7);
    const a = acc.get(mk) ?? { consumption: 0, production: 0, grid: 0, days: 0, consumptionDays: 0 };
    const consumption = r.consumption_kwh == null ? null : Number(r.consumption_kwh);
    const production = r.production_kwh == null ? 0 : Number(r.production_kwh);
    if (consumption != null) {
      a.consumption += consumption;
      a.consumptionDays += 1;
    }
    a.production += production;
    a.grid += r.grid_import_kwh == null ? 0 : Number(r.grid_import_kwh);
    if ((consumption ?? 0) > 0 || production > 0) a.days += 1;
    acc.set(mk, a);
  }
  const basis: TierBasis = new Map();
  for (const [mk, a] of acc) {
    const hasConsumption = a.consumptionDays > 0;
    const total = hasConsumption ? a.consumption : a.production;
    if (total > 0) basis.set(mk, { total, grid: a.grid, days: a.days, hasConsumption });
  }
  return basis;
}
