import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { Breadcrumb } from "@/layout/Breadcrumb";
import { Button, Card, ErrorNotice, Field, Input, PageHeader, Textarea, cx } from "@/components/ui";
import { usePortal } from "@/lib/portal";
import { createPmsRequest, type PmsRequest } from "@/lib/tickets";
import { invalidateTickets } from "@/lib/useTickets";
import { env } from "@/lib/env";
import { PMS } from "@/content/contact";
import { todayKey } from "@/lib/energy";

const STEPS = ["Client & site information", "Preferred schedule", "Site access", "System condition"];
const TIME_SLOTS = [
  { id: "Morning (8:00 AM - 12 NN)", title: "Morning", sub: "8:00 AM - 12 NN" },
  { id: "Afternoon (1:00 PM - 5:00 PM)", title: "Afternoon", sub: "1:00 PM - 5:00 PM" },
  { id: "Flexible (any time)", title: "Flexible", sub: "any time" },
];
const ROOF = ["1-storey (4 meters or lower)", "Multi-storey (more than 4 meters)", "I'm not sure"];
const EQUIPMENT = ["No special equipment needed", "Ladder (client to provide)", "Scaffolding", "Not sure"];
const PERMIT = ["No", "Yes - I will arrange the work permit", "Yes - please coordinate with HOA", "Not sure - please advise"];
const CONDITION = ["No - everything seems to be working fine", "Yes - I've noticed some issues"];

function ChoiceCard({ selected, onClick, title, sub, multi }: { selected: boolean; onClick: () => void; title: string; sub?: string; multi?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cx("flex w-full items-start justify-between rounded-lg border p-4 text-left transition-colors", selected ? "border-brand-olive bg-green-50" : "border-neutral-200 bg-white hover:bg-neutral-50")}>
      <span>
        <span className="block text-base font-semibold text-neutral-900">{title}</span>
        {sub && <span className="mt-1 block text-sm text-neutral-500">{sub}</span>}
      </span>
      <span className={cx("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border", multi ? "rounded" : "rounded-full", selected ? "border-brand-dark bg-brand-dark text-white" : "border-neutral-300 bg-white")}>{selected && <Check className="h-3.5 w-3.5" />}</span>
    </button>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-neutral-700">{label}</p>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

const splitName = (full: string) => {
  const parts = full.trim().split(/\s+/);
  return { first: parts.slice(0, -1).join(" ") || parts[0] || "", last: parts.length > 1 ? parts[parts.length - 1] : "" };
};

export default function PmsRequestPage() {
  const { profile, system } = usePortal();
  const navigate = useNavigate();
  const name = splitName(profile?.full_name ?? profile?.odoo_customer_name ?? "");
  const [step, setStep] = useState(0);
  const [f, setF] = useState<PmsRequest>({
    firstName: name.first,
    lastName: name.last,
    email: profile?.email ?? "",
    phone: profile?.phone ?? "",
    siteAddress: system?.address ?? profile?.address ?? "",
    stationId: system?.solis_station_id ?? profile?.solis_station_id ?? "",
    preferredDate: "",
    timeSlot: "",
    alternativeDate: "",
    roofHeight: "",
    equipment: [],
    workPermit: "",
    siteContactName: "",
    siteContactPhone: "",
    instructions: "",
    condition: "",
    concerns: "",
  });
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof PmsRequest>(k: K, v: PmsRequest[K]) => setF((s) => ({ ...s, [k]: v }));

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (step === 0) {
      if (!f.firstName.trim()) e.firstName = "Required";
      if (!f.lastName.trim()) e.lastName = "Required";
      if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = "Enter a valid email";
      if (!f.phone.trim()) e.phone = "Required";
      if (!f.siteAddress.trim()) e.siteAddress = "Required";
    }
    if (step === 1) {
      if (!f.preferredDate) e.preferredDate = "Pick a date";
      else if (f.preferredDate < todayKey()) e.preferredDate = "Pick a future date";
      if (!f.timeSlot) e.timeSlot = "Pick a time slot";
    }
    if (step === 2 && !f.roofHeight) e.roofHeight = "Tell us how high the roof is";
    if (step === 3) {
      if (!f.condition) e.condition = "Please answer";
      if (!consent) e.consent = "Please confirm to proceed";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => validate() && setStep((s) => Math.min(s + 1, 3));
  const back = () => (step === 0 ? navigate("/support/pms") : setStep((s) => s - 1));

  const submit = async () => {
    if (!validate()) return;
    setBusy(true);
    setError(null);
    try {
      await createPmsRequest(f);
      if (profile?.email) invalidateTickets(profile.email);
      navigate("/support/success", { state: { kind: "pms", dryRun: !env.submissionsEnabled } });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleEquipment = (v: string) => set("equipment", f.equipment.includes(v) ? f.equipment.filter((x) => x !== v) : [...f.equipment, v]);

  return (
    <>
      <Breadcrumb items={[{ label: "Home", to: "/" }, { label: "Support", to: "/support" }, { label: "Request PMS" }]} />
      <PageHeader title="Request PMS" subtitle="Fill out this form to request a Preventive Maintenance Service (PMS) for your system. Our team will reach out to you to coordinate the schedule." />
      <Card className="grid gap-8 lg:grid-cols-[320px_1fr]">
        <ol className="flex flex-col gap-5">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-3">
              <span className={cx("flex h-7 w-7 items-center justify-center rounded-full border text-sm font-semibold", i === step ? "border-brand-olive bg-green-50 text-brand-olive" : i < step ? "border-brand-olive bg-brand-olive text-white" : "border-neutral-300 text-neutral-500")}>{i < step ? <Check className="h-4 w-4" /> : i + 1}</span>
              <span className={cx("text-base", i === step ? "font-semibold text-neutral-900" : "text-neutral-500")}>{s}</span>
            </li>
          ))}
        </ol>

        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">
            <span className="text-brand-olive">Step {step + 1}:</span> {STEPS[step]}
          </h2>
          {error && (
            <div className="mt-4">
              <ErrorNotice message={error} />
            </div>
          )}

          {step === 0 && (
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field label="First name" required error={errors.firstName}>
                <Input value={f.firstName} onChange={(e) => set("firstName", e.target.value)} invalid={!!errors.firstName} />
              </Field>
              <Field label="Last name" required error={errors.lastName}>
                <Input value={f.lastName} onChange={(e) => set("lastName", e.target.value)} invalid={!!errors.lastName} />
              </Field>
              <Field label="Email address" required error={errors.email}>
                <Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} invalid={!!errors.email} />
              </Field>
              <Field label="Contact number" required error={errors.phone}>
                <Input type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} invalid={!!errors.phone} />
              </Field>
              <Field label="Site / installation address" required error={errors.siteAddress} className="sm:col-span-2">
                <Input value={f.siteAddress} onChange={(e) => set("siteAddress", e.target.value)} invalid={!!errors.siteAddress} />
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="mt-6 flex flex-col gap-6">
              <Field label="Preferred date" required error={errors.preferredDate}>
                <Input type="date" min={todayKey()} value={f.preferredDate} onChange={(e) => set("preferredDate", e.target.value)} invalid={!!errors.preferredDate} className="sm:max-w-xs" />
              </Field>
              <div>
                <p className="mb-2 text-sm font-medium text-neutral-700">
                  Preferred time slot <span className="text-red-700">*</span>
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {TIME_SLOTS.map((t) => (
                    <ChoiceCard key={t.id} selected={f.timeSlot === t.id} onClick={() => set("timeSlot", t.id)} title={t.title} sub={t.sub} />
                  ))}
                </div>
                {errors.timeSlot && <p className="mt-1.5 text-sm text-red-700">{errors.timeSlot}</p>}
              </div>
              <Field label="Alternative date" hint="Optional">
                <Input type="date" min={todayKey()} value={f.alternativeDate} onChange={(e) => set("alternativeDate", e.target.value)} className="sm:max-w-xs" />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="mt-6 flex flex-col gap-6">
              <Group label="How high is your roof from the ground? *">
                {ROOF.map((r) => (
                  <ChoiceCard key={r} selected={f.roofHeight === r} onClick={() => set("roofHeight", r)} title={r} />
                ))}
              </Group>
              {errors.roofHeight && <p className="-mt-4 text-sm text-red-700">{errors.roofHeight}</p>}
              <Group label="Required equipment to access rooftop (select all that apply)">
                {EQUIPMENT.map((r) => (
                  <ChoiceCard key={r} multi selected={f.equipment.includes(r)} onClick={() => toggleEquipment(r)} title={r} />
                ))}
              </Group>
              <Group label="Work permit required?">
                {PERMIT.map((r) => (
                  <ChoiceCard key={r} selected={f.workPermit === r} onClick={() => set("workPermit", r)} title={r} />
                ))}
              </Group>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Site contact person" hint="If different from the client information">
                  <Input value={f.siteContactName} onChange={(e) => set("siteContactName", e.target.value)} />
                </Field>
                <Field label="Site contact no.">
                  <Input type="tel" value={f.siteContactPhone} onChange={(e) => set("siteContactPhone", e.target.value)} />
                </Field>
              </div>
              <Field label="Additional instructions" hint="Optional">
                <Textarea value={f.instructions} onChange={(e) => set("instructions", e.target.value)} placeholder="e.g., gate code, parking, requirements" className="min-h-[90px]" />
              </Field>
            </div>
          )}

          {step === 3 && (
            <div className="mt-6 flex flex-col gap-6">
              <Group label="Have you noticed any issues with your system? *">
                {CONDITION.map((r) => (
                  <ChoiceCard key={r} selected={f.condition === r} onClick={() => set("condition", r)} title={r} />
                ))}
              </Group>
              {errors.condition && <p className="-mt-4 text-sm text-red-700">{errors.condition}</p>}
              <Field label="Other concerns or questions" hint="Optional">
                <Textarea value={f.concerns} onChange={(e) => set("concerns", e.target.value)} className="min-h-[90px]" />
              </Field>
              <label className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 accent-brand-dark" />
                <span>{PMS.consent}</span>
              </label>
              {errors.consent && <p className="-mt-4 text-sm text-red-700">{errors.consent}</p>}
            </div>
          )}
        </div>
      </Card>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={back} disabled={busy}>
          Back
        </Button>
        {step < 3 ? (
          <Button onClick={next} className="min-w-[180px]">
            Next
          </Button>
        ) : (
          <Button onClick={submit} loading={busy} className="min-w-[180px]">
            Submit
          </Button>
        )}
      </div>
    </>
  );
}
