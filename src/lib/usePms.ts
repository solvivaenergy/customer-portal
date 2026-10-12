import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchMyPms } from "./pms";
import type { PmsRecord, Profile, SolarSystem } from "./types";

const cache = new Map<string, { at: number; rows: PmsRecord[] }>();
const TTL_MS = 60_000;

/** The signed-in customer's Maintenance-app PMS requests (matched by email, Odoo partner id or lead ids). */
export function useMyPms(profile: Profile | null, systems: SolarSystem[]) {
  const key = useMemo(() => {
    if (!profile) return null;
    const leadIds = systems.map((s) => s.odoo_lead_id).filter((x): x is number => typeof x === "number");
    return JSON.stringify({ email: profile.email, partnerId: profile.odoo_partner_id ?? null, leadIds });
  }, [profile, systems]);
  const [rows, setRows] = useState<PmsRecord[] | null>(() => (key && cache.get(key)?.rows) || null);
  const [loading, setLoading] = useState(!rows);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (force = false) => {
      if (!key) return;
      const hit = cache.get(key);
      if (!force && hit && Date.now() - hit.at < TTL_MS) {
        setRows(hit.rows);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const r = await fetchMyPms(JSON.parse(key));
        cache.set(key, { at: Date.now(), rows: r });
        setRows(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [key],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return { pms: rows, loading, error, refresh: () => load(true) };
}

export function invalidatePms() {
  cache.clear();
}
