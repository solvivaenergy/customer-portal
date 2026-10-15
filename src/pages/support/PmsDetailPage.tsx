import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronDown, Inbox } from "lucide-react";
import { Breadcrumb } from "@/layout/Breadcrumb";
import { Badge, Button, Card, Collapse, EmptyState, ErrorNotice, PageHeader, Spinner } from "@/components/ui";
import { usePortal } from "@/lib/portal";
import { useMyPms } from "@/lib/usePms";
import { dateTime, longDate, relative } from "@/lib/format";
import { CONTACT } from "@/content/contact";
import { STATUS_TONE } from "./SupportHubPage";

const slotLabel = (s: string | null) => (s ? { morning: "Morning (8:00 AM – 12 NN)", afternoon: "Afternoon (1:00 PM – 5:00 PM)", flexible: "Flexible (any time)" }[s.toLowerCase()] ?? s : null);

export default function PmsDetailPage() {
  const { id } = useParams();
  const { profile, systems } = usePortal();
  const { pms, loading, error } = useMyPms(profile, systems);
  const [activityOpen, setActivityOpen] = useState(true);
  const req = pms?.find((r) => String(r.id) === id);

  if (loading && !pms)
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );

  return (
    <div className="anim-fade-in">
      <Breadcrumb items={[{ label: "Home", to: "/" }, { label: "Support", to: "/support" }, { label: req?.ref ?? `PMS-${id}` }]} />
      {error && <ErrorNotice message={error} />}
      {!req ? (
        <Card padded={false}>
          <EmptyState icon={<Inbox className="h-6 w-6" />} title="PMS request not found" description="This request is not linked to your account." action={<Link to="/support"><Button variant="secondary">Back to Support</Button></Link>} />
        </Card>
      ) : (
        <>
          <PageHeader title="PMS request" subtitle={req.name} />
          <div className="grid gap-6 lg:grid-cols-[440px_1fr]">
            <Card>
              <h3 className="text-lg font-semibold text-neutral-900">Request details</h3>
              <dl className="mt-4 divide-y divide-neutral-200 text-sm">
                {(
                  [
                    ["Request no.", req.ref],
                    ["Status", <Badge tone={STATUS_TONE[req.status]}>{req.stage}</Badge>],
                    ["Requested on", req.requestDate ? longDate(req.requestDate) : dateTime(req.createdAt)],
                    ["Preferred date", req.preferredDate ? longDate(req.preferredDate) : "—"],
                    ["Preferred time", slotLabel(req.timeSlot) ?? "—"],
                    ["Alternative date", req.alternativeDate ? longDate(req.alternativeDate) : "—"],
                    ["Scheduled visit", req.scheduleDate ? dateTime(req.scheduleDate) : "To be confirmed"],
                    ["Technician", req.technician ?? "To be assigned"],
                    ["Site address", req.siteAddress ?? "—"],
                    ["Roof / access", [req.panelLocation, req.accessEquipment].filter(Boolean).join(" · ") || "—"],
                    ["Work permit", req.workPermit ?? "—"],
                    ["Site contact", req.siteContact ?? "—"],
                    ["Issues noticed", req.hasIssues ? req.issueDescription || "Yes" : "No"],
                    ["Other requests", req.otherRequests ?? "—"],
                  ] as [string, React.ReactNode][]
                ).map(([k, v]) => (
                  <div key={k} className="flex gap-4 py-3">
                    <dt className="w-32 shrink-0 text-neutral-500">{k}</dt>
                    <dd className="min-w-0 text-neutral-800">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>

            <Card>
              <h3 className="text-lg font-semibold text-neutral-900">Updates</h3>
              <p className="mt-2 text-sm text-neutral-500">Our Aftersales team confirms the schedule and shares the PMS report by email. Replies from the portal are coming soon.</p>
              <button onClick={() => setActivityOpen((o) => !o)} className="mt-6 flex w-full items-center justify-between border-t border-neutral-200 pt-4 text-sm font-semibold text-neutral-700">
                Activity
                <ChevronDown className={`h-4 w-4 transition-transform ${activityOpen ? "rotate-180" : ""}`} />
              </button>
              <Collapse open={activityOpen}>
                <ul className="mt-4 flex flex-col gap-5">
                  <li className="flex gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-light text-xs font-semibold text-brand-dark">SC</span>
                    <div className="text-sm">
                      <p className="font-medium text-neutral-800">
                        {CONTACT.email} <span className="ml-2 font-normal text-neutral-500">{relative(req.createdAt)}</span>
                      </p>
                      <p className="mt-1 text-neutral-600">
                        Hi {profile?.full_name?.split(" ")[0] ?? "there"}, we received your preventive maintenance request {req.ref}. Current stage: <strong>{req.stage}</strong>. Our Aftersales team will reach out within 2 business days to confirm your schedule.
                      </p>
                    </div>
                  </li>
                  {req.description && (
                    <li className="flex gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-700">You</span>
                      <div className="min-w-0 text-sm">
                        <p className="font-medium text-neutral-800">
                          Request form <span className="ml-2 font-normal text-neutral-500">{relative(req.createdAt)}</span>
                        </p>
                        <pre className="mt-1 whitespace-pre-wrap font-sans text-neutral-600">{req.description}</pre>
                      </div>
                    </li>
                  )}
                </ul>
              </Collapse>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
