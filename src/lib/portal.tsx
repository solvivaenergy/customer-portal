import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import { useAuth } from "@/auth/AuthProvider";
import type { Profile, Provider, Rate, SolarSystem } from "./types";

type PortalState = {
  profile: Profile | null;
  systems: SolarSystem[];
  system: SolarSystem | null; // selected site
  selectSystem: (id: string) => void;
  providers: Provider[];
  rates: Rate[];
  providerFor: (s: SolarSystem | null) => Provider | null;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [p, s, pr, rt] = await Promise.all([
        supabase.from("user_profiles").select("id,full_name,phone,address,referral_code,solis_station_id,electricity_provider_id,odoo_customer_name,odoo_partner_id").eq("id", user.id).maybeSingle(),
        supabase.from("solar_systems").select("id,user_id,system_name,capacity_kwp,installation_date,battery_capacity_kwh,address,status,solis_station_id,solis_plant_name,is_primary,electricity_provider_id").order("is_primary", { ascending: false }).order("created_at"),
        supabase.from("electricity_providers").select("id,name,code").order("id"),
        supabase.from("electricity_rates").select("id,provider_id,rate,effective_date").order("effective_date"),
      ]);
      for (const r of [p, s, pr, rt]) if (r.error) throw new Error(r.error.message);
      setProfile(p.data ? { ...(p.data as Omit<Profile, "email">), email: user.email ?? "" } : { id: user.id, email: user.email ?? "", full_name: null, phone: null, address: null, referral_code: null, solis_station_id: null, electricity_provider_id: null, odoo_customer_name: null, odoo_partner_id: null });
      const sys = ((s.data ?? []) as SolarSystem[]).filter((x) => x.status !== "decommissioned");
      setSystems(sys);
      setProviders((pr.data ?? []) as Provider[]);
      setRates(((rt.data ?? []) as Rate[]).map((r) => ({ ...r, rate: Number(r.rate) })));
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
    [profile, systems, system, providers, rates, loading, error, load, user],
  );

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export function usePortal(): PortalState {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error("usePortal must be used inside PortalProvider");
  return ctx;
}
