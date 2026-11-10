import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { TriangleAlert } from "lucide-react";
import { Breadcrumb } from "@/layout/Breadcrumb";
import { Button, Card, ErrorNotice, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { odooEmail, odooIdentity, usePortal } from "@/lib/portal";
import { createTicket, SAFETY_GROUP, TICKET_CATEGORIES } from "@/lib/tickets";
import { invalidateTickets } from "@/lib/useTickets";
import { env } from "@/lib/env";
import { CONTACT } from "@/content/contact";

export default function NewTicketPage() {
  const { profile, system, systems } = usePortal();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState(profile?.full_name ?? profile?.odoo_customer_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [category, setCategory] = useState("");
  const [details, setDetails] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const groups = [...new Set(TICKET_CATEGORIES.map((c) => c.group))];
  const isSafety = TICKET_CATEGORIES.find((c) => c.value === category)?.group === SAFETY_GROUP;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = "Please enter the system owner's name.";
    if (!category) errs.category = "Please select a concern type.";
    if (details.trim().length < 10) errs.details = "Please describe your concern (at least 10 characters).";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setError(null);
    try {
      // Filed under the customer's Odoo email so it lands on their Odoo partner, whatever they sign in with.
      await createTicket({ fullName: fullName.trim(), email: odooEmail(profile), phone: phone.trim(), stationId: system?.solis_station_id ?? profile?.solis_station_id ?? "", category, details: details.trim() });
      invalidateTickets(odooIdentity(profile, systems));
      navigate("/support/success", { state: { kind: "ticket", dryRun: !env.submissionsEnabled } });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Breadcrumb items={[{ label: "Home", to: "/" }, { label: "Support", to: "/support" }, { label: "Submit a ticket" }]} />
      <PageHeader title="Submit a ticket" subtitle="Got a question or need help? Tell us and our support team will get back to you as soon as possible." />
      <div className="anim-fade-up">
        <Card className="max-w-3xl">
          <form onSubmit={submit} className="flex flex-col gap-5">
            {error && <ErrorNotice message={error} />}
            <Field label="Full name of system owner" required error={errors.fullName}>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} invalid={!!errors.fullName} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Contact number">
                <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09XX XXX XXXX" />
              </Field>
              <Field label="Email" hint="Tickets are linked to the email on your Solviva account.">
                <Input value={odooEmail(profile)} disabled />
              </Field>
            </div>
            <div className="flex flex-col gap-3">
              <Field label="Concern type" required error={errors.category}>
                <Select value={category} onChange={(e) => setCategory(e.target.value)} invalid={!!errors.category}>
                  <option value="">Please specify</option>
                  {groups.map((g) => (
                    <optgroup key={g} label={g}>
                      {TICKET_CATEGORIES.filter((c) => c.group === g).map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.value}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
              </Field>
              {/* A ticket is no way to report an emergency: a Safety concern shows the hotline at once (Lili, 2026-11-10).
                  A native select cannot hold a note above its options, so the notice sits under the field instead. */}
              {isSafety && (
                <div role="alert" className="anim-fade-up flex items-start gap-3 rounded-lg border border-amber-700/20 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <p>
                    If you see smoke or sparks, or get an electric shock, call our hotline right away:{" "}
                    <a href={`tel:${CONTACT.technical.tel}`} className="font-semibold whitespace-nowrap hover:underline">
                      {CONTACT.technical.phone}
                    </a>
                  </p>
                </div>
              )}
            </div>
            <Field label="Details about your concern" required error={errors.details}>
              <Textarea value={details} onChange={(e) => setDetails(e.target.value)} invalid={!!errors.details} placeholder="Tell us what happened, when it started, and anything you've already tried." />
            </Field>
            <div className="flex justify-end gap-3 pt-2">
              <Link to="/support">
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" loading={busy}>
                Submit
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
