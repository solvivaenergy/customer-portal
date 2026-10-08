import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronDown, Inbox } from "lucide-react";
import { Breadcrumb } from "@/layout/Breadcrumb";
import { Badge, Button, Card, EmptyState, ErrorNotice, PageHeader, Spinner, Textarea } from "@/components/ui";
import { usePortal } from "@/lib/portal";
import { useTickets } from "@/lib/useTickets";
import { dateTime, initials, relative } from "@/lib/format";
import { CONTACT } from "@/content/contact";
import { STATUS_TONE } from "./SupportHubPage";

export default function TicketDetailPage() {
  const { id } = useParams();
  const { profile } = usePortal();
  const { tickets, loading, error } = useTickets(profile?.email);
  const [activityOpen, setActivityOpen] = useState(true);
  const ticket = tickets?.find((t) => String(t.id) === id);

  if (loading && !tickets)
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );

  return (
    <>
      <Breadcrumb items={[{ label: "Home", to: "/" }, { label: "Support", to: "/support" }, { label: ticket?.ref ?? `#${id}` }]} />
      {error && <ErrorNotice message={error} />}
      {!ticket ? (
        <Card padded={false}>
          <EmptyState icon={<Inbox className="h-6 w-6" />} title="Ticket not found" description="This ticket is not linked to your email address." action={<Link to="/support"><Button variant="secondary">Back to Support</Button></Link>} />
        </Card>
      ) : (
        <>
          <PageHeader title={ticket.kind === "pms" ? "PMS request" : "Support ticket"} subtitle={ticket.subject} />
          <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
            <Card>
              <h3 className="text-lg font-semibold text-neutral-900">Ticket details</h3>
              <dl className="mt-4 divide-y divide-neutral-200 text-sm">
                {[
                  ["Ticket no.", ticket.ref],
                  ["Date created", dateTime(ticket.createdAt)],
                  ["Subject", ticket.subject],
                  ["Stage", ticket.stage],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-4 py-3">
                    <dt className="w-28 shrink-0 text-neutral-500">{k}</dt>
                    <dd className="text-neutral-800">{v}</dd>
                  </div>
                ))}
                <div className="flex gap-4 py-3">
                  <dt className="w-28 shrink-0 text-neutral-500">Description</dt>
                  <dd className="whitespace-pre-line text-neutral-800">{ticket.description || "—"}</dd>
                </div>
                <div className="flex gap-4 py-3">
                  <dt className="w-28 shrink-0 text-neutral-500">Status</dt>
                  <dd>
                    <Badge tone={STATUS_TONE[ticket.status]}>{ticket.status}</Badge>
                  </dd>
                </div>
              </dl>
            </Card>

            <Card>
              <h3 className="text-lg font-semibold text-neutral-900">Communication history</h3>
              <div className="mt-4">
                <Textarea placeholder="Replies from the portal are coming soon. For now, reply to the confirmation email from our support team." disabled />
                <div className="mt-3 flex justify-end">
                  <Button disabled title="Replying from the portal is not available yet">
                    Send
                  </Button>
                </div>
              </div>
              <button onClick={() => setActivityOpen((o) => !o)} className="mt-6 flex w-full items-center justify-between border-t border-neutral-200 pt-4 text-sm font-semibold text-neutral-700">
                Activity
                <ChevronDown className={`h-4 w-4 transition-transform ${activityOpen ? "rotate-180" : ""}`} />
              </button>
              {activityOpen && (
                <ul className="mt-4 flex flex-col gap-5">
                  <li className="flex gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-light text-xs font-semibold text-brand-dark">SC</span>
                    <div className="text-sm">
                      <p className="font-medium text-neutral-800">
                        {CONTACT.email} <span className="ml-2 font-normal text-neutral-500">{relative(ticket.createdAt)}</span>
                      </p>
                      <p className="mt-1 text-neutral-600">
                        Hi {profile?.full_name?.split(" ")[0] ?? "there"}, this is to confirm that we received your {ticket.kind === "pms" ? "PMS request" : "support ticket"} {ticket.ref}. Our team will reach out to you as soon as possible. Thank you!
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-700">{initials(profile?.full_name)}</span>
                    <div className="text-sm">
                      <p className="font-medium text-neutral-800">
                        You <span className="ml-2 font-normal text-neutral-500">{relative(ticket.createdAt)}</span>
                      </p>
                      <p className="mt-1 whitespace-pre-line text-neutral-600">{ticket.description || ticket.subject}</p>
                    </div>
                  </li>
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
