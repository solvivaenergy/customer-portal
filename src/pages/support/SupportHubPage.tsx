import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, ChevronRight, Inbox } from "lucide-react";
import { PhoneCallIcon, PmsToolsIcon, SupportTicketIcon } from "@/components/icons";
import { Breadcrumb } from "@/layout/Breadcrumb";
import { Badge, Button, Card, EmptyState, ErrorNotice, PageHeader, Segmented, Spinner, cx, type BadgeTone } from "@/components/ui";
import { usePortal } from "@/lib/portal";
import { useTickets } from "@/lib/useTickets";
import { useMyPms } from "@/lib/usePms";
import { dateTime, longDate, shortDate, truncate } from "@/lib/format";
import type { PmsRecord, Ticket, TicketStatus } from "@/lib/types";

export const STATUS_TONE: Record<TicketStatus, BadgeTone> = { New: "blue", "In Progress": "amber", Resolved: "green", Cancelled: "neutral" };

const PAGE_SIZE = 10;

/* `tour` marks the card for the onboarding tour (lib/tour.tsx), which finds it by data-tour. */
function ActionCard({ to, icon, title, description, tour }: { to: string; icon: React.ReactNode; title: string; description: string; tour?: string }) {
  return (
    <Link to={to} data-tour={tour} className="group block rounded-xl border border-neutral-200 bg-white p-6 shadow-xs transition-shadow duration-200 hover:shadow-sm">
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
      {/* Phones show arrows only (Figma "Mobile_support"); the words come back from sm up. */}
      <button onClick={() => onChange(page - 1)} disabled={page === 1} className="flex items-center gap-2 font-semibold text-neutral-600 disabled:opacity-40" aria-label="Previous page">
        <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Previous</span>
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
      <button onClick={() => onChange(page + 1)} disabled={page === pages} className="flex items-center gap-2 font-semibold text-neutral-600 disabled:opacity-40" aria-label="Next page">
        <span className="hidden sm:inline">Next</span> <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/* The activities table: on a phone only the reference and the status (Figma "Mobile_support"); the
   other columns (`wide`) appear from md up. Every row opens the ticket / request. */
const cell = "px-4 py-4 md:px-6";
const wideCell = "hidden md:table-cell";

function Th({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return <th className={cx("px-4 py-3 font-medium md:px-6", wide && wideCell)}>{children}</th>;
}

function RefLink({ to, children }: { to: string; children: React.ReactNode }) {
  // The row itself navigates on click; the link keeps the reference focusable and stops the double navigation.
  return (
    <Link to={to} onClick={(e) => e.stopPropagation()} className="font-medium text-neutral-900 hover:text-brand-blue">
      {children}
    </Link>
  );
}

export default function SupportHubPage() {
  const { profile, systems } = usePortal();
  const tickets = useTickets(profile?.email);
  const pms = useMyPms(profile, systems);
  const navigate = useNavigate();
  const [kind, setKind] = useState<"support" | "pms">("support");
  const [page, setPage] = useState(1);

  const active = kind === "support" ? { rows: tickets.tickets, loading: tickets.loading, error: tickets.error } : { rows: pms.pms, loading: pms.loading, error: pms.error };
  const rows = active.rows ?? [];
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <Breadcrumb items={[{ label: "Home", to: "/" }, { label: "Support" }]} />
      <PageHeader title="Support and Helpdesk" subtitle="Submit a ticket, request a maintenance visit, or reach our team." />

      <div className="anim-fade-up">
        <div className="grid gap-5 md:grid-cols-3">
          <ActionCard to="/support/tickets/new" icon={<SupportTicketIcon className="h-12 w-12" />} title="Submit a support ticket" description="For technical and non-technical concerns, submit a ticket" tour="ticket" />
          <ActionCard to="/support/pms" icon={<PmsToolsIcon className="h-12 w-12" />} title="Request PMS" description="Request to schedule your preventive maintenance service for your system" tour="pms" />
          <ActionCard to="/support/contact" icon={<PhoneCallIcon className="h-12 w-12" />} title="Contact support" description="Reach out to our hotline and email for assistance." tour="contact" />
        </div>

        {/* Phone: heading + Refresh on one line, the Support | PMS switch stretched across the next
            (Figma "Mobile_support"). From sm up: heading, then the switch beside Refresh. */}
        <div className="mb-4 mt-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-4">
          <h2 className="text-2xl font-semibold text-neutral-900 sm:basis-full">My activities</h2>
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
            stretch
            className="order-last basis-full sm:order-none sm:basis-auto"
          />
          <Button variant="ghost" size="sm" onClick={() => (kind === "support" ? tickets.refresh() : pms.refresh())} disabled={active.loading} className="ml-auto sm:order-last">
            Refresh
          </Button>
        </div>

        <Card padded={false} className="overflow-hidden">
          {/* Keyed so switching Support/PMS, paging and loading → loaded ease in. */}
          <div key={`${kind}-${page}-${active.rows ? "ready" : "loading"}`} className="anim-fade-in">
            {active.error ? (
              <div className="p-6">
                <ErrorNotice message={`Could not load your ${kind === "pms" ? "PMS requests" : "tickets"}: ${active.error}`} />
              </div>
            ) : active.loading && !active.rows ? (
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
            ) : kind === "support" ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-neutral-100 text-neutral-700">
                    <tr>
                      <Th>Ticket No.</Th>
                      <Th wide>Subject</Th>
                      <Th wide>Description</Th>
                      <Th wide>Created</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(visible as Ticket[]).map((t) => (
                      <tr key={t.id} onClick={() => navigate(`/support/tickets/${t.id}`)} className="cursor-pointer border-t border-neutral-200 hover:bg-neutral-50">
                        <td className={cell}>
                          <RefLink to={`/support/tickets/${t.id}`}>{t.ref}</RefLink>
                        </td>
                        <td className={cx(cell, wideCell, "text-neutral-700")}>{truncate(t.subject, 40)}</td>
                        <td className={cx(cell, wideCell, "text-neutral-600")}>{truncate(t.description, 48) || "—"}</td>
                        <td className={cx(cell, wideCell, "text-neutral-700")}>{shortDate(t.createdAt)}</td>
                        <td className={cell}>
                          <Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-neutral-100 text-neutral-700">
                    <tr>
                      <Th>Request No.</Th>
                      <Th wide>Subject</Th>
                      <Th wide>Scheduled visit</Th>
                      <Th wide>Requested</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(visible as PmsRecord[]).map((r) => (
                      <tr key={r.id} onClick={() => navigate(`/support/pms/requests/${r.id}`)} className="cursor-pointer border-t border-neutral-200 hover:bg-neutral-50">
                        <td className={cell}>
                          <RefLink to={`/support/pms/requests/${r.id}`}>{r.ref}</RefLink>
                        </td>
                        <td className={cx(cell, wideCell, "text-neutral-700")}>{truncate(r.name, 44)}</td>
                        <td className={cx(cell, wideCell, "text-neutral-600")}>{r.scheduleDate ? dateTime(r.scheduleDate) : "To be confirmed"}</td>
                        <td className={cx(cell, wideCell, "text-neutral-700")}>{r.requestDate ? longDate(r.requestDate) : shortDate(r.createdAt)}</td>
                        <td className={cell}>
                          <Badge tone={STATUS_TONE[r.status]}>{r.stage}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
        <Pagination page={page} pages={pages} onChange={setPage} />
      </div>
    </>
  );
}
