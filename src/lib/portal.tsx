import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import { useAuth } from "@/auth/AuthProvider";
import { fetchSystemDetails, type SystemDetails } from "./system";
import type { Profile, Provider, Rate, RateTier, SolarSystem } from "./types";

type PortalState = {
  profile: Profile | null;
  systems: SolarSystem[];
  system: SolarSystem | null; // selected site
  selectSystem: (id: string) => void;
  providers: Provider[];
  rates: Rate[];
  providerFor: (s: SolarSystem | null) => Provider | null;
  /** Equipment details from the CRM lead (battery, inverter, sales rep); null while loading or when unavailable. */
  detailsFor: (s: SolarSystem | null) => SystemDetails | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<Profile, "full_name" | "phone" | "address">>) => Promise<void>;
};

const PortalContext = createContext<PortalState | null>(null);
const SELECTED_KEY = "portal.selectedSystem";

export function PortalProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [systems, setSystems] = useState<SolarSystem[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(() => localStorage.getItem(SELECTED_KEY));
  const [details, setDetails] = useState<Record<number, SystemDetails>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lead-based equipment details, fetched once the systems are known; failures only hide the extra rows.
  useEffect(() => {
    const ids = systems.map((s) => s.odoo_lead_id).filter((x): x is number => typeof x === "number");
    if (!ids.length) return;
    let alive = true;
    fetchSystemDetails(ids)
      .then((d) => alive && setDetails(d))
      .catch((e) => console.warn("system details unavailable:", e.message));
    return () => {
      alive = false;
    };
  }, [systems]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [p, s, pr, rt, tr] = await Promise.all([
        supabase.from("user_profiles").select("id,full_name,phone,address,referral_code,solis_station_id,electricity_provider_id,odoo_customer_name,odoo_partner_id").eq("id", user.id).maybeSingle(),
        supabase.from("solar_systems").select("id,user_id,system_name,capacity_kwp,odoo_installed_date,energization_date,battery_capacity_kwh,address,status,solis_station_id,solis_plant_name,is_primary,electricity_provider_id,odoo_lead_id").order("is_primary", { ascending: false }).order("created_at"),
        supabase.from("electricity_providers").select("id,name,code").order("id"),
        // Homes are billed on the residential schedule; commercial rows (none yet) would otherwise collide on the same date.
        supabase.from("electricity_rates").select("id,provider_id,rate,effective_date,customer_class,net_metering_rate").eq("customer_class", "residential").order("effective_date"),
        // Consumption levels of tiered schedules (MERALCO residential; monitoring migration 28 opened the read).
        supabase.from("electricity_rate_tiers").select("rate_id,consumption_kwh,rate_per_kwh").order("consumption_kwh"),
      ]);
      for (const r of [p, s, pr, rt]) if (r.error) throw new Error(r.error.message);
      if (tr.error) console.warn("rate tiers unavailable, using flat rates:", tr.error.message);
      setProfile(p.data ? { ...(p.data as Omit<Profile, "email">), email: user.email ?? "" } : { id: user.id, email: user.email ?? "", full_name: null, phone: null, address: null, referral_code: null, solis_station_id: null, electricity_provider_id: null, odoo_customer_name: null, odoo_partner_id: null });
      const sys = ((s.data ?? []) as SolarSystem[]).filter((x) => x.status !== "decommissioned");
      setSystems(sys);
      setProviders((pr.data ?? []) as Provider[]);
      const tiersByRate = new Map<number, RateTier[]>();
      for (const t of (tr.data ?? []) as { rate_id: number; consumption_kwh: number | string; rate_per_kwh: number | string }[]) {
        const list = tiersByRate.get(t.rate_id) ?? [];
        list.push({ consumption_kwh: Number(t.consumption_kwh), rate_per_kwh: Number(t.rate_per_kwh) });
        tiersByRate.set(t.rate_id, list);
      }
      setRates(((rt.data ?? []) as Omit<Rate, "tiers">[]).map((r) => ({ ...r, rate: Number(r.rate), net_metering_rate: r.net_metering_rate == null ? null : Number(r.net_metering_rate), tiers: (tiersByRate.get(r.id) ?? []).sort((a, b) => a.consumption_kwh - b.consumption_kwh) })));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const system = useMemo(() => {
    if (!systems.length) return null;
    return systems.find((s) => s.id === selectedId) ?? systems.find((s) => s.is_primary) ?? systems[0];
  }, [systems, selectedId]);

  const value = useMemo<PortalState>(
    () => ({
      profile,
      systems,
      system,
      selectSystem: (id) => {
        setSelectedId(id);
        localStorage.setItem(SELECTED_KEY, id);
      },
      providers,
      rates,
      providerFor: (s) => providers.find((p) => p.id === (s?.electricity_provider_id ?? profile?.electricity_provider_id)) ?? null,
      detailsFor: (s) => (s?.odoo_lead_id != null ? (details[s.odoo_lead_id] ?? null) : null),
      loading,
      error,
      refresh: load,
      updateProfile: async (patch) => {
        if (!user) throw new Error("Not signed in");
        const { error: err } = await supabase.from("user_profiles").update(patch).eq("id", user.id);
        if (err) throw new Error(err.message);
        setProfile((p) => (p ? { ...p, ...patch } : p));
      },
    }),
    [profile, systems, system, providers, rates, details, loading, error, load, user],
  );

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export function usePortal(): PortalState {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error("usePortal must be used inside PortalProvider");
  return ctx;
}
