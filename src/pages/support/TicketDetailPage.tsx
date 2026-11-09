import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronDown, Inbox } from "lucide-react";
import { Breadcrumb } from "@/layout/Breadcrumb";
import { Badge, Button, Card, Collapse, EmptyState, ErrorNotice, PageHeader, Spinner, Textarea, cx } from "@/components/ui";
import { odooEmail, usePortal } from "@/lib/portal";
import { useTickets } from "@/lib/useTickets";
import { useTicketMessages } from "@/lib/useTicketMessages";
import { dateTime, initials, relative } from "@/lib/format";
import type { Ticket, TicketMessage } from "@/lib/types";
import { STATUS_TONE } from "./SupportHubPage";

const REPLY_MAX = 5000;

/* One chatter entry (Figma "Help Center_Main" row pop-up): avatar, who, when, the text. Solviva's
   replies show the address they came from, as in the mockup. */
function MessageItem({ m, myName }: { m: TicketMessage; myName: string | null | undefined }) {
  return (
    <li className="flex gap-3">
      <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold", m.staff ? "bg-brand-light text-brand-dark" : "bg-neutral-100 text-neutral-700")}>
        {m.staff ? "SC" : m.mine ? initials(myName) : initials(m.author)}
      </span>
      <div className="min-w-0 text-sm">
        <p className="font-medium text-neutral-800">
          {m.staff ? (m.email ?? m.author) : m.author} <span className="ml-2 font-normal text-neutral-500">{relative(m.date)}</span>
        </p>
        <p className="mt-1 whitespace-pre-line wrap-anywhere text-neutral-600">{m.body}</p>
      </div>
    </li>
  );
}

/**
 * The "Ticket details" card. Values take the rest of the row and break anywhere (emails and links in
 * a subject would otherwise push the card wider than the page). The description gets its own block:
 * label above, text across the card, line breaks as Odoo has them — an emailed ticket can run to
 * several paragraphs and read badly squeezed beside a label.
 * Exported for the dev preview (/dev/preview?screen=ticket-detail), which renders it with sample tickets.
 */
export function TicketDetailsCard({ ticket }: { ticket: Ticket }) {
  return (
    <Card>
      <h3 className="text-lg font-semibold text-neutral-900">Ticket details</h3>
      <dl className="mt-4 divide-y divide-neutral-200 text-sm">
        {[
          ["Ticket no.", ticket.ref],
          ["Date created", dateTime(ticket.createdAt)],
          ["Category", ticket.categories.join(", ") || "—"],
          ["Subject", ticket.subject],
        ].map(([k, v]) => (
          <div key={k} className="flex gap-4 py-3">
            <dt className="w-28 shrink-0 text-neutral-500">{k}</dt>
            <dd className="min-w-0 flex-1 wrap-anywhere text-neutral-800">{v}</dd>
          </div>
        ))}
        <div className="py-3">
          <dt className="text-neutral-500">Description</dt>
          <dd className="mt-1.5 whitespace-pre-line wrap-anywhere text-neutral-800">{ticket.description || "—"}</dd>
        </div>
        <div className="flex gap-4 py-3">
          <dt className="w-28 shrink-0 text-neutral-500">Status</dt>
          <dd>
            <Badge tone={STATUS_TONE[ticket.status]}>{ticket.status}</Badge>
          </dd>
        </div>
      </dl>
    </Card>
  );
}

export default function TicketDetailPage() {
  const { id } = useParams();
  const { profile } = usePortal();
  const { tickets, loading, error } = useTickets(odooEmail(profile));
  const ticket = tickets?.find((t) => String(t.id) === id);
  const thread = useTicketMessages(odooEmail(profile), ticket?.id ?? null, profile?.odoo_partner_id ?? null);
  const [activityOpen, setActivityOpen] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setSendError(null);
    try {
      await thread.reply(body);
      setDraft("");
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  if (loading && !tickets)
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );

  return (
    <>
      <Breadcrumb items={[{ label: "Home", to: "/" }, { label: "Support", to: "/support" }, { label: ticket?.ref ?? `#${id}` }]} />
      <div className="anim-fade-up">
        {error && <ErrorNotice message={error} />}
        {!ticket ? (
          <Card padded={false}>
            <EmptyState icon={<Inbox className="h-6 w-6" />} title="Ticket not found" description="This ticket is not linked to your email address." action={<Link to="/support"><Button variant="secondary">Back to Support</Button></Link>} />
          </Card>
        ) : (
          <>
            <PageHeader title={ticket.kind === "pms" ? "PMS request" : "Support ticket"} subtitle={ticket.subject} />
            {/* min-w-0 on the grid: the two cards must shrink with the page instead of stretching it. */}
            <div className="grid min-w-0 gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
              <TicketDetailsCard ticket={ticket} />

              <Card className="min-w-0">
                <h3 className="text-lg font-semibold text-neutral-900">Communication history</h3>
                {/* A reply lands on the ticket's chatter in Odoo as the customer's own message, so the support team sees it where they work. */}
                <form onSubmit={send} className="mt-4">
                  <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={REPLY_MAX} placeholder="Write a reply to our support team…" aria-label="Reply" disabled={sending} />
                  {sendError && (
                    <div className="mt-3">
                      <ErrorNotice message={`Your reply was not sent: ${sendError}`} />
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-xs text-neutral-400">{draft.length > REPLY_MAX * 0.8 ? `${draft.length} / ${REPLY_MAX}` : ""}</span>
                    <Button type="submit" loading={sending} disabled={!draft.trim()}>
                      Send
                    </Button>
                  </div>
                </form>

                <button onClick={() => setActivityOpen((o) => !o)} className="mt-6 flex w-full items-center justify-between border-t border-neutral-200 pt-4 text-sm font-semibold text-neutral-700">
                  Activity
                  <ChevronDown className={`h-4 w-4 transition-transform ${activityOpen ? "rotate-180" : ""}`} />
                </button>
                <Collapse open={activityOpen}>
                  {thread.error ? (
                    <div className="mt-4">
                      <ErrorNotice message={`Could not load the conversation: ${thread.error}`} />
                    </div>
                  ) : thread.loading && !thread.messages ? (
                    <div className="flex justify-center py-8">
                      <Spinner />
                    </div>
                  ) : !thread.messages?.length ? (
                    <p className="mt-4 text-sm text-neutral-500">No messages yet. Our team's replies and your own will appear here.</p>
                  ) : (
                    <ul className="mt-4 flex flex-col gap-5">
                      {thread.messages.map((m) => (
                        <MessageItem key={m.id} m={m} myName={profile?.full_name} />
                      ))}
                    </ul>
                  )}
                </Collapse>
              </Card>
            </div>
          </>
        )}
      </div>
    </>
  );
}
