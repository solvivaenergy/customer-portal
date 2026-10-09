import { useEffect, useMemo, useState } from "react";
import { BatteryCharging, ChevronLeft, ChevronRight, Coins, Handshake, Share2, Zap } from "lucide-react";
import { usePortal } from "@/lib/portal";
import { api } from "@/lib/api";
import { aggregateDaily, aggregateHours, fetchDailyReadings, fetchDayHours, fetchLatestFiveMinute, lifetime, periodBounds, RANGES, shiftPeriod, todayKey, type Aggregate, type Period, type RangeId } from "@/lib/energy";
import { dateFromKey, kwh, manilaDateKey, num, php, firstName, greeting, shortDate, dateTime } from "@/lib/format";
import type { DailyReading, FiveMinuteRow, HourBucket, LiveData } from "@/lib/types";
import { Badge, Button, Card, EmptyState, ErrorNotice, PageHeader, Segmented, Select, Spinner, cx } from "@/components/ui";
import { REFERRAL } from "@/content/contact";
import { ConsumptionChart, LEGEND, SavingsChart } from "./charts";
import { CelebrationOverlay, ShareModal, type ShareKind } from "./share";

/* --------------------------------------------------------------- helpers */

/** Daily rows hold a zero placeholder for today until the overnight sync; patch today from the live totals. */
function patchToday(rows: DailyReading[], live: LiveData | null): DailyReading[] {
  if (!live) return rows;
  const today = todayKey();
  const todayRow: DailyReading = {
    timestamp: dateFromKey(today).toISOString(),
    production_kwh: live.today_production_kwh,
    consumption_kwh: live.today_consumption_kwh || null,
    grid_import_kwh: live.today_grid_import_kwh,
    grid_export_kwh: live.today_grid_export_kwh,
    battery_level: live.battery_level,
    battery_status: live.battery_status,
    // Today's "Battery" share of the week/month bar; null on an API older than 2026-10-09
    // (then it shows 0.0, as it always did before).
    battery_charge_kwh: live.today_battery_charge_kwh ?? null,
    battery_discharge_kwh: live.today_battery_discharge_kwh ?? null,
  };
  const idx = rows.findIndex((r) => manilaDateKey(r.timestamp) === today);
  if (idx === -1) return [...rows, todayRow];
  const existing = rows[idx];
  if ((existing.production_kwh ?? 0) >= live.today_production_kwh) return rows; // sync already wrote a fuller row
  const copy = rows.slice();
  copy[idx] = todayRow;
  return copy;
}

function PeriodNav({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  const b = periodBounds(period);
  const atToday = period.anchor >= todayKey();
  return (
    <div className="inline-flex items-center rounded-lg border border-neutral-300 bg-white shadow-xs">
      {b.canNav && (
        <button onClick={() => onChange(shiftPeriod(period, -1))} className="px-2 py-2 text-neutral-500 hover:text-neutral-800" aria-label="Previous period">
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      <span className={cx("px-3 py-2 text-sm font-semibold text-neutral-700", !b.canNav && "px-4")}>{b.title}</span>
      {b.canNav && (
        <button onClick={() => onChange(shiftPeriod(period, 1))} disabled={atToday} className="px-2 py-2 text-neutral-500 hover:text-neutral-800 disabled:opacity-30" aria-label="Next period">
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function usePeriod(initial: RangeId) {
  const [period, setPeriod] = useState<Period>({ range: initial, anchor: todayKey() });
  const setRange = (range: RangeId) => setPeriod({ range, anchor: todayKey() });
  return { period, setPeriod, setRange };
}

/* ------------------------------------------------------------------ page */

export default function HomePage() {
  const { profile, system, systems, selectSystem, rates, providerFor, loading, error } = usePortal();
  const providerId = system?.electricity_provider_id ?? profile?.electricity_provider_id ?? null;
  const provider = providerFor(system);
  // The monitoring API answers for the login's own station; only use it when that is the selected site.
  const apiStation = !!system && (!profile?.solis_station_id || profile.solis_station_id === system.solis_station_id);

  const savings = usePeriod("YTD");
  const perf = usePeriod("YTD");

  const [daily, setDaily] = useState<DailyReading[] | null>(null);
  const [live, setLive] = useState<LiveData | null>(null);
  const [latest5, setLatest5] = useState<FiveMinuteRow | null>(null);
  const [savingsHours, setSavingsHours] = useState<{ key: string; hours: HourBucket[] } | null>(null);
  const [perfHours, setPerfHours] = useState<{ key: string; hours: HourBucket[] } | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [share, setShare] = useState<ShareKind | null>(null);
  const [celebrate, setCelebrate] = useState<ShareKind | null>(null);

  // Base data per system
  useEffect(() => {
    if (!system) return;
    let alive = true;
    setDaily(null);
    setLive(null);
    setLatest5(null);
    setDataError(null);
    fetchDailyReadings(system.id)
      .then((rows) => alive && setDaily(rows))
      .catch((e) => alive && setDataError(e.message));
    fetchLatestFiveMinute(system.id)
      .then((r) => alive && setLatest5(r))
      .catch(() => undefined);
    if (apiStation) {
      api
        .live()
        .then((l) => alive && setLive(l))
        .catch((e) => console.warn("live data unavailable:", e.message));
    }
    return () => {
      alive = false;
    };
  }, [system, apiStation]);

  // Hourly data for 1D views
  useEffect(() => {
    if (!system || savings.period.range !== "1D") return;
    let alive = true;
    const key = savings.period.anchor;
    fetchDayHours(system, key, apiStation).then((h) => alive && setSavingsHours({ key, hours: h })).catch((e) => alive && setDataError(e.message));
    return () => {
      alive = false;
    };
  }, [system, apiStation, savings.period]);
  useEffect(() => {
    if (!system || perf.period.range !== "1D") return;
    let alive = true;
    const key = perf.period.anchor;
    fetchDayHours(system, key, apiStation).then((h) => alive && setPerfHours({ key, hours: h })).catch((e) => alive && setDataError(e.message));
    return () => {
      alive = false;
    };
  }, [system, apiStation, perf.period]);

  const rows = useMemo(() => (daily ? patchToday(daily, live) : null), [daily, live]);
  const life = useMemo(() => (rows ? lifetime(rows, rates, providerId) : null), [rows, rates, providerId]);

  const savingsAgg: Aggregate | null = useMemo(() => {
    if (savings.period.range === "1D") return savingsHours?.key === savings.period.anchor ? aggregateHours(savingsHours.hours, savings.period.anchor, rates, providerId) : null;
    return rows ? aggregateDaily(rows, savings.period, rates, providerId) : null;
  }, [savings.period, savingsHours, rows, rates, providerId]);

  const perfAgg: Aggregate | null = useMemo(() => {
    if (perf.period.range === "1D") return perfHours?.key === perf.period.anchor ? aggregateHours(perfHours.hours, perf.period.anchor, rates, providerId) : null;
    return rows ? aggregateDaily(rows, perf.period, rates, providerId) : null;
  }, [perf.period, perfHours, rows, rates, providerId]);

  const sinceLabel = life?.since ? dateFromKey(life.since).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }) : null;
  const referralEarnings = 0; // Placeholder: no referral-earnings source yet.

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  if (error) return <ErrorNotice message={error} />;

  if (!system) {
    return (
      <>
        <PageHeader title={`${greeting()}, ${firstName(profile?.full_name || profile?.odoo_customer_name)}`} subtitle="Track and manage your solar savings" />
        <Card padded={false}>
          <EmptyState icon={<Zap className="h-6 w-6" />} title="No solar system linked to this account yet" description="Once your system is linked you will see your production, consumption and savings here. If you believe this is an error, submit a support ticket." />
        </Card>
      </>
    );
  }

  const batteryLevel = live?.battery_level ?? latest5?.battery_level ?? null;
  const batteryStatus = live?.battery_status ?? latest5?.battery_status ?? null;
  const hasBattery = (system.battery_capacity_kwh ?? 0) > 0 || batteryLevel != null;
  const perfHasConsumption = perfAgg ? perfAgg.consumption != null : true;
  const split = perfAgg && perfAgg.consumption ? { grid: perfAgg.grid / perfAgg.consumption, solar: perfAgg.solar / perfAgg.consumption, battery: perfAgg.battery / perfAgg.consumption } : null;
  const selfShare = split ? Math.round((split.solar + split.battery) * 100) : null;
  const perfBounds = periodBounds(perf.period);
  const savingsBounds = periodBounds(savings.period);
  const xInterval = (p: Period) => (p.range === "1M" ? 2 : p.range === "1D" ? 2 : 0);

  return (
    <>
      <PageHeader title={`${greeting()}, ${firstName(profile?.full_name || profile?.odoo_customer_name)}`} subtitle="Track and manage your solar savings" />

      <div className="mb-6 flex items-center gap-3">
        <span className="text-base text-neutral-700">Site ID:</span>
        {systems.length > 1 ? (
          <Select value={system.id} onChange={(e) => selectSystem(e.target.value)} className="w-auto min-w-[220px] py-2 text-sm">
            {systems.map((s) => (
              <option key={s.id} value={s.id}>
                {(s.system_name || s.solis_plant_name || "System").trim()} · {s.solis_station_id}
              </option>
            ))}
          </Select>
        ) : (
          <span className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 shadow-xs">{system.solis_station_id ?? system.system_name ?? "—"}</span>
        )}
      </div>

      {dataError && (
        <div className="mb-6">
          <ErrorNotice message={`Some data could not be loaded: ${dataError}`} />
        </div>
      )}

      {/* ---------------------------------------------------------- Hero */}
      <div className="grid gap-6 lg:grid-cols-[1fr_304px]">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-base text-neutral-600">Total savings from Solar</p>
              {savingsAgg ? <p className="mt-1 text-4xl font-semibold tracking-tight text-neutral-900">{php(savingsAgg.savings)}</p> : <div className="mt-2 h-9 w-48 animate-pulse rounded bg-neutral-100" />}
              <p className="mt-1 text-sm text-neutral-500">{savingsBounds.subtitle}</p>
            </div>
            <PeriodNav period={savings.period} onChange={savings.setPeriod} />
          </div>
          <div className="mt-6">
            {savingsAgg ? (
              savingsAgg.days === 0 ? (
                <EmptyState title="No data for this period" description="Your inverter did not report any production in this period." />
              ) : (
                <SavingsChart points={savingsAgg.points} interval={xInterval(savings.period)} />
              )
            ) : (
              <div className="flex h-64 items-center justify-center">
                <Spinner />
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <Segmented options={RANGES} value={savings.period.range} onChange={savings.setRange} size="sm" />
          </div>
          {savingsAgg?.estimatedRate && (
            <p className="mt-3 text-center text-xs text-neutral-500">
              Estimated with {provider ? `${provider.code} ` : "MERALCO "}rates; some months use the nearest published rate.
            </p>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <button onClick={() => setCelebrate("savings")} className="text-left" disabled={!life}>
            <Card className="transition-shadow hover:shadow-sm">
              <div className="flex items-start justify-between">
                <p className="text-base text-neutral-600">Total savings from solar</p>
                <Coins className="h-6 w-6 text-brand-absinthe" />
              </div>
              <p className="mt-2 text-2xl font-semibold text-neutral-900">{life ? php(life.savings) : "—"}</p>
              {sinceLabel && <p className="mt-1 text-xs text-neutral-500">Since {sinceLabel} · {kwh(life?.production ?? 0)} produced</p>}
            </Card>
          </button>
          <button onClick={() => setCelebrate("referral")} className="text-left">
            <Card className="transition-shadow hover:shadow-sm">
              <div className="flex items-start justify-between">
                <p className="text-base text-neutral-600">Referral earnings</p>
                <Handshake className="h-6 w-6 text-brand-absinthe" />
              </div>
              <p className="mt-2 text-2xl font-semibold text-neutral-900">{php(referralEarnings, { decimals: 0 })}</p>
              <Badge tone="neutral" className="mt-2">
                Tracking coming soon
              </Badge>
            </Card>
          </button>
          <div className="rounded-xl bg-brand-chartreuse p-6">
            <p className="text-lg font-semibold text-brand-blue">Refer and Earn</p>
            <p className="mt-1 text-sm text-brand-dark">{REFERRAL.blurb}</p>
            <Button variant="dark" full className="mt-4" onClick={() => setShare("referral")}>
              <Share2 className="h-4 w-4" /> Share code
            </Button>
            {profile?.referral_code && <p className="mt-2 text-center text-xs text-brand-dark/80">Your code: {profile.referral_code}</p>}
          </div>
        </div>
      </div>

      {/* --------------------------------------------------- Performance */}
      <h2 className="mb-4 mt-10 text-2xl font-semibold text-neutral-900">Your system's performance</h2>
      <div className="grid gap-6 lg:grid-cols-[1fr_304px]">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-neutral-700">{perfHasConsumption ? "Total consumption" : "Total production"}</p>
              {perfAgg ? <p className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">{kwh(perfHasConsumption ? (perfAgg.consumption ?? 0) : perfAgg.production)}</p> : <div className="mt-2 h-8 w-40 animate-pulse rounded bg-neutral-100" />}
              <p className="mt-1 text-sm text-neutral-500">{perfBounds.subtitle}</p>
            </div>
            <PeriodNav period={perf.period} onChange={perf.setPeriod} />
          </div>
          <div className="mt-6">
            {perfAgg ? (
              perfAgg.days === 0 ? (
                <EmptyState title="No data for this period" description="Your inverter did not report any data in this period." />
              ) : (
                <ConsumptionChart points={perfAgg.points} hasConsumption={perfHasConsumption} interval={xInterval(perf.period)} />
              )
            ) : (
              <div className="flex h-64 items-center justify-center">
                <Spinner />
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-5 text-sm text-neutral-600">
            {perfHasConsumption ? (
              LEGEND.map((l) => (
                <span key={l.key} className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-sm" style={{ background: l.color }} /> {l.label}
                </span>
              ))
            ) : (
              <span className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-sm bg-brand-absinthe" /> Solar production
              </span>
            )}
          </div>
          <div className="mt-4 flex justify-center">
            <Segmented options={RANGES} value={perf.period.range} onChange={perf.setRange} size="sm" />
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            {perfAgg && perfHasConsumption ? (
              <>
                <p className="text-base text-neutral-600">Total consumption</p>
                <p className="mt-2 text-2xl font-semibold text-neutral-900">{kwh(perfAgg.consumption ?? 0)}</p>
                <p className="text-sm text-neutral-500">{perfBounds.subtitle.replace(/^Since /, "since ")}</p>
                {split && (
                  <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-neutral-100">
                    <span style={{ width: `${split.grid * 100}%`, background: LEGEND[0].color }} />
                    <span style={{ width: `${split.solar * 100}%`, background: LEGEND[1].color }} />
                    <span style={{ width: `${split.battery * 100}%`, background: LEGEND[2].color }} />
                  </div>
                )}
                <ul className="mt-4 flex flex-col gap-2 text-sm">
                  {[
                    { l: LEGEND[0], v: perfAgg.grid },
                    { l: LEGEND[1], v: perfAgg.solar },
                    { l: LEGEND[2], v: perfAgg.battery },
                  ].map(({ l, v }) => (
                    <li key={l.key} className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-neutral-700">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: l.color }} /> {l.label}
                      </span>
                      <span className="text-neutral-600">{num(v, 1)} kWh</span>
                    </li>
                  ))}
                </ul>
                {selfShare != null && (
                  <p className="mt-4 rounded-lg bg-green-50 px-3 py-2.5 text-sm text-green-700">
                    {selfShare}% of your consumption {perf.period.range === "1D" ? "today came" : "came"} from your solar{perfAgg.battery > 0 ? " and battery" : ""}.
                  </p>
                )}
              </>
            ) : perfAgg ? (
              <>
                <p className="text-base text-neutral-600">Total production</p>
                <p className="mt-2 text-2xl font-semibold text-neutral-900">{kwh(perfAgg.production)}</p>
                <p className="text-sm text-neutral-500">{perfBounds.subtitle}</p>
                <p className="mt-4 rounded-lg bg-neutral-50 px-3 py-2.5 text-sm text-neutral-600">Consumption data isn't available for this system, so the breakdown by source can't be shown.</p>
              </>
            ) : (
              <div className="h-40 animate-pulse rounded bg-neutral-100" />
            )}
          </Card>

          <Card>
            {hasBattery ? (
              <>
                <p className="flex items-center gap-2 text-base font-semibold text-neutral-800">
                  <span className={cx("inline-block h-2.5 w-2.5 rounded-full", batteryStatus === "charging" ? "bg-green-700" : batteryStatus === "discharging" ? "bg-amber-700" : "bg-neutral-400")} />
                  Battery {batteryStatus ?? "status unknown"}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">as of {latest5?.timestamp ? dateTime(latest5.timestamp) : shortDate(new Date())}</p>
                <div className="relative mt-4 h-10 overflow-hidden rounded-lg bg-neutral-200">
                  <div className="h-full bg-brand-chartreuse" style={{ width: `${Math.max(0, Math.min(100, batteryLevel ?? 0))}%` }} />
                  <span className="absolute inset-y-0 left-3 flex items-center text-lg font-semibold text-brand-dark">{batteryLevel != null ? `${Math.round(batteryLevel)}%` : "—"}</span>
                </div>
                <p className="mt-3 text-sm text-neutral-600">{system.battery_capacity_kwh ? `${num(system.battery_capacity_kwh)} kWh battery` : "Battery storage"}</p>
              </>
            ) : (
              <div className="flex items-start gap-3">
                <BatteryCharging className="mt-0.5 h-5 w-5 text-neutral-400" />
                <div>
                  <p className="text-sm font-semibold text-neutral-700">No battery storage</p>
                  <p className="mt-0.5 text-sm text-neutral-500">This system has no battery linked. Interested in storage? Contact our team.</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      <CelebrationOverlay
        open={celebrate !== null}
        onClose={() => setCelebrate(null)}
        kind={celebrate ?? "savings"}
        amount={celebrate === "referral" ? referralEarnings : (life?.savings ?? 0)}
        since={sinceLabel}
        onShare={() => {
          setShare(celebrate ?? "savings");
          setCelebrate(null);
        }}
      />
      <ShareModal open={share !== null} onClose={() => setShare(null)} kind={share ?? "savings"} amount={share === "referral" ? referralEarnings : (life?.savings ?? 0)} since={sinceLabel} code={profile?.referral_code ?? null} />
    </>
  );
}
