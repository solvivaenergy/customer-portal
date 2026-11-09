import { useCallback, useEffect, useState } from "react";
import { env } from "./env";
import { fetchTicketMessages, postTicketReply, type OdooIdentity } from "./tickets";
import type { TicketMessage } from "./types";

/**
 * A ticket's customer-visible chatter, newest first, and a `reply` that posts to it. The reply
 * shows up at once; with submissions enabled the thread is then re-read so the entry carries
 * Odoo's id and timestamp (with them disabled the local copy is all there is).
 */
export function useTicketMessages(me: OdooIdentity | null | undefined, ticketId: number | null) {
  const [messages, setMessages] = useState<TicketMessage[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = me ? JSON.stringify([me.email, me.partnerId, me.leadIds]) : null;

  const load = useCallback(async () => {
    if (!me || ticketId == null) return;
    setLoading(true);
    setError(null);
    try {
      setMessages(await fetchTicketMessages(me, ticketId));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures everything in `me`
  }, [key, ticketId]);

  useEffect(() => {
    void load();
  }, [load]);

  const reply = useCallback(
    async (body: string) => {
      if (!me || ticketId == null) throw new Error("Not signed in");
      await postTicketReply(me, ticketId, body);
      const local: TicketMessage = { id: -Date.now(), body, author: "You", email: me.email, date: new Date().toISOString(), mine: true, staff: false };
      setMessages((m) => [local, ...(m ?? [])]);
      if (env.submissionsEnabled) void load();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures everything in `me`
    [key, ticketId, load],
  );

  return { messages, loading, error, reply, refresh: load };
}
