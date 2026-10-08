import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, ChevronRight, Headset, Inbox, PhoneCall, Wrench } from "lucide-react";
import { Breadcrumb } from "@/layout/Breadcrumb";
import { Badge, Button, Card, EmptyState, ErrorNotice, PageHeader, Segmented, Spinner, cx, type BadgeTone } from "@/components/ui";
import { usePortal } from "@/lib/portal";
import { useTickets } from "@/lib/useTickets";
import { shortDate, truncate } from "@/lib/format";
import type { Ticket, TicketStatus } from "@/lib/types";

export const STATUS_TONE: Record<TicketStatus, BadgeTone> = { New: "blue", "In Progress": "amber", Resolved: "green", Cancelled: "neutral" };

const PAGE_SIZE = 10;

function ActionCard({ to, icon, title, description }: { to: string; icon: React.ReactNode; title: string; description: string }) {
  return (
    <Link to={to} className="group block rounded-xl border border-neutral-200 bg-white p-6 shadow-xs transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between">
        <span className="text-brand-absinthe">{icon}</span>
        <ChevronRight className="h-5 w-5 text-neutral-400 transition-transform group-hover:translate-x-0.5" />
      </div>
      <p className="mt-6 text-xl font-semibold text-neutral-900">{title}</p>
      <p className="mt-1 text-sm text-neutral-500">{description}</p>
    </Link>
  );
}

function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null;
  const items: (number | "…")[] = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) items.push(i);
    else if (items[items.length - 1] !== "…") items.push("…");
  }
  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <button onClick={() => onChange(page - 1)} disabled={page === 1} className="flex items-center gap-2 font-semibold text-neutral-600 disabled:opacity-40">
        <ArrowLeft className="h-4 w-4" /> Previous
      </button>
      <div className="flex items-center gap-1">
        {items.map((it, i) =>
          it === "…" ? (
            <span key={`e${i}`} className="px-2 text-neutral-400">
              …
            </span>
          ) : (
            <button key={it} onClick={() => onChange(it)} className={cx("h-10 w-10 rounded-lg font-medium", it === page ? "bg-brand-light text-brand-dark" : "text-neutral-600 hover:bg-neutral-100")}>
              {it}
            </button>
          ),
        )}
      </div>
      <button onClick={() => onChange(page + 1)} disabled={page === pages} className="flex items-center gap-2 font-semibold text-neutral-600 disabled:opacity-40">
        Next <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function SupportHubPage() {
  const { profile } = usePortal();
  const { tickets, loading, error, refresh } = useTickets(profile?.email);
  const [kind, setKind] = useState<"support" | "pms">("support");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => (tickets ?? []).filter((t) => t.kind === kind), [tickets, kind]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <Breadcrumb items={[{ label: "Home", to: "/" }, { label: "Support" }]} />
      <PageHeader title="Support and Helpdesk" subtitle="Submit a ticket, request a maintenance visit, or reach our team." />

      <div className="grid gap-5 md:grid-cols-3">
        <ActionCard to="/support/tickets/new" icon={<Headset className="h-10 w-10" />} title="Submit a support ticket" description="For technical and non-technical concerns, submit a ticket" />
        <ActionCard to="/support/pms" icon={<Wrench className="h-10 w-10" />} title="Request PMS" description="Request to schedule your preventive maintenance service for your system" />
        <ActionCard to="/support/contact" icon={<PhoneCall className="h-10 w-10" />} title="Contact support" description="Reach out to our hotline and email for assistance." />
      </div>

      <h2 className="mb-4 mt-10 text-2xl font-semibold text-neutral-900">My activities</h2>
      <div className="mb-4 flex items-center justify-between">
        <Segmented
          options={[
            { id: "support", label: "Support" },
            { id: "pms", label: "PMS" },
          ]}
          value={kind}
          onChange={(k) => {
            setKind(k);
            setPage(1);
          }}
        />
        <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
          Refresh
        </Button>
      </div>

      <Card padded={false} className="overflow-hidden">
        {error ? (
          <div className="p-6">
            <ErrorNotice message={`Could not load your tickets: ${error}`} />
          </div>
        ) : loading && !tickets ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-6 w-6" />}
            title={kind === "pms" ? "No PMS requests yet" : "No support tickets yet"}
            description={kind === "pms" ? "Your preventive maintenance requests will be listed here." : "Tickets you submit will be listed here with their status."}
            action={
              <Link to={kind === "pms" ? "/support/pms" : "/support/tickets/new"}>
                <Button variant="secondary">{kind === "pms" ? "Request PMS" : "Submit a ticket"}</Button>
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-100 text-neutral-700">
                <tr>
                  <th className="px-6 py-3 font-medium">Ticket No.</th>
                  <th className="px-6 py-3 font-medium">Subject</th>
                  <th className="px-6 py-3 font-medium">Description</th>
                  <th className="px-6 py-3 font-medium">Created</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((t: Ticket) => (
                  <tr key={t.id} className="border-t border-neutral-200 hover:bg-neutral-50">
                    <td className="px-6 py-4">
                      <Link to={`/support/tickets/${t.id}`} className="font-medium text-neutral-900 hover:text-brand-blue">
                        {t.ref}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-neutral-700">{truncate(t.subject, 40)}</td>
                    <td className="px-6 py-4 text-neutral-600">{truncate(t.description, 48) || "—"}</td>
                    <td className="px-6 py-4 text-neutral-700">{shortDate(t.createdAt)}</td>
                    <td className="px-6 py-4">
                      <Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Pagination page={page} pages={pages} onChange={setPage} />
    </>
  );
}
