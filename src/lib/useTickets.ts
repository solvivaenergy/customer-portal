import { useCallback, useEffect, useState } from "react";
import { fetchMyTickets, type OdooIdentity } from "./tickets";
import type { Ticket } from "./types";

const cache = new Map<string, { at: number; tickets: Ticket[] }>();
const TTL_MS = 60_000;
const keyOf = (me: OdooIdentity | null | undefined) => (me ? JSON.stringify([me.email, me.partnerId, me.leadIds]) : null);

/** The customer's tickets, cached a minute per identity (partner id, lead ids, Odoo email). */
export function useTickets(me: OdooIdentity | null | undefined) {
  const key = keyOf(me);
  const [tickets, setTickets] = useState<Ticket[] | null>(() => (key && cache.get(key)?.tickets) || null);
  const [loading, setLoading] = useState(!tickets);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (force = false) => {
      if (!me || !key) return;
      const hit = cache.get(key);
      if (!force && hit && Date.now() - hit.at < TTL_MS) {
        setTickets(hit.tickets);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const t = await fetchMyTickets(me);
        cache.set(key, { at: Date.now(), tickets: t });
        setTickets(t);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures everything in `me`
    [key],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return { tickets, loading, error, refresh: () => load(true) };
}

export function invalidateTickets(me: OdooIdentity | null | undefined) {
  const key = keyOf(me);
  if (key) cache.delete(key);
}
