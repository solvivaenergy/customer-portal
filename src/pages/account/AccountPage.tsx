import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronDown, FileText, LifeBuoy, LogOut } from "lucide-react";
import { Breadcrumb } from "@/layout/Breadcrumb";
import { Badge, Button, ErrorNotice, Input, Modal, PageHeader, Tabs } from "@/components/ui";
import { usePortal } from "@/lib/portal";
import { useAuth } from "@/auth/AuthProvider";
import { longDate, num } from "@/lib/format";
import { FAQS } from "@/content/faqs";
import { PRIVACY, PRIVACY_META, TERMS, TERMS_META, type LegalSection } from "@/content/legal";
import { PASSWORD_RULES, passwordOk } from "@/pages/auth/ResetPasswordPage";
import { Link } from "react-router-dom";

type TabId = "profile" | "system" | "documents" | "faqs" | "terms" | "privacy";
const TABS: { id: TabId; label: string }[] = [
  { id: "profile", label: "My profile" },
  { id: "system", label: "System details" },
  { id: "documents", label: "Documents" },
  { id: "faqs", label: "FAQs" },
  { id: "terms", label: "Terms and Conditions" },
  { id: "privacy", label: "Privacy Policy" },
];

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="mt-8 max-w-3xl">
      <h2 className="text-xl font-semibold text-neutral-900">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
      <div className="mt-5 border-t border-neutral-200">{children}</div>
    </div>
  );
}

function Row({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="grid gap-2 border-b border-neutral-200 py-5 sm:grid-cols-[1fr_432px] sm:items-center">
      <div>
        <p className="text-sm font-medium text-neutral-700">{label}</p>
        {hint && <p className="text-xs text-neutral-500">{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

/* ----------------------------------------------------------------- Profile */

function ProfileTab() {
  const { profile, updateProfile } = usePortal();
  const { changePassword, signOut } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [address, setAddress] = useState(profile?.address ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setPhone(profile?.phone ?? "");
    setAddress(profile?.address ?? "");
  }, [profile]);

  const dirty = fullName !== (profile?.full_name ?? "") || phone !== (profile?.phone ?? "") || address !== (profile?.address ?? "");

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (phone && !/^[+\d\s()-]{7,20}$/.test(phone)) return setError("Enter a valid contact number.");
    setSaving(true);
    setError(null);
    try {
      await updateProfile({ full_name: fullName.trim() || null, phone: phone.trim() || null, address: address.trim() || null });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save}>
      <Section title="Profile" subtitle="Update your account details here. These details pre-fill your PMS requests and support tickets.">
        {error && (
          <div className="pt-4">
            <ErrorNotice message={error} />
          </div>
        )}
        <Row label="Full name">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Row>
        <Row label="Contact number">
          <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+63 9XX XXX XXXX" />
        </Row>
        <Row label="Address" hint="Billing / installation address">
          <Input value={address} onChange={(e) => setAddress(e.target.value)} />
        </Row>
        <Row label="Email address" hint="Your sign-in email. Contact support to change it.">
          <Input value={profile?.email ?? ""} disabled />
        </Row>
        <Row label="Account password">
          <div className="flex items-center gap-3">
            <Input value="••••••••" disabled className="max-w-[220px]" />
            <Button type="button" variant="secondary" onClick={() => setPwOpen(true)}>
              Change password
            </Button>
          </div>
        </Row>
        <div className="flex items-center justify-between pt-6">
          <Button type="button" variant="ghost" onClick={() => setLogoutOpen(true)}>
            <LogOut className="h-4 w-4" /> Log out
          </Button>
          <div className="flex items-center gap-3">
            {saved && <span className="text-sm text-green-700">Saved</span>}
            <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
              Back
            </Button>
            <Button type="submit" loading={saving} disabled={!dirty}>
              Save changes
            </Button>
          </div>
        </div>
      </Section>

      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} onChange={changePassword} />
      <Modal open={logoutOpen} onClose={() => setLogoutOpen(false)} title="Log out">
        <p className="text-sm text-neutral-600">Are you sure you want to log out?</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setLogoutOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              await signOut();
              navigate("/login", { replace: true });
            }}
          >
            Log out
          </Button>
        </div>
      </Modal>
    </form>
  );
}

function ChangePasswordModal({ open, onClose, onChange }: { open: boolean; onClose: () => void; onChange: (cur: string, next: string) => Promise<void> }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!passwordOk(next)) return setError(PASSWORD_RULES);
    if (next !== confirm) return setError("New passwords do not match.");
    setBusy(true);
    setError(null);
    try {
      await onChange(current, next);
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Change password">
      {done ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-green-700">Your password has been updated.</p>
          <Button onClick={onClose}>Done</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          {error && <ErrorNotice message={error} />}
          <label className="block text-sm font-medium text-neutral-700">
            Current password
            <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required className="mt-1.5" />
          </label>
          <label className="block text-sm font-medium text-neutral-700">
            New password
            <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required className="mt-1.5" />
            <span className="mt-1 block text-xs font-normal text-neutral-500">{PASSWORD_RULES}</span>
          </label>
          <label className="block text-sm font-medium text-neutral-700">
            Confirm new password
            <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className="mt-1.5" />
          </label>
          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Update password
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ System */

function SystemTab() {
  const { system, systems, selectSystem, providerFor } = usePortal();
  const provider = providerFor(system);
  if (!system)
    return (
      <Section title="System details" subtitle="See your system information">
        <p className="pt-5 text-sm text-neutral-500">No solar system is linked to this account yet.</p>
      </Section>
    );
  const items: [string, ReactNode][] = [
    ["System", `${system.capacity_kwp ? `${num(system.capacity_kwp, 2)} kWp Solar Power System` : "Solar Power System"}${system.battery_capacity_kwh ? ` · ${num(system.battery_capacity_kwh)} kWh Battery Storage` : ""}`],
    ["Site address", system.address || "—"],
    ["Installation date", system.installation_date ? longDate(system.installation_date) : "—"],
    ["Plant name (Solis)", system.solis_plant_name || "—"],
    ["Site ID", system.solis_station_id || "—"],
    ["Electricity provider", provider ? `${provider.name} (${provider.code})` : "—"],
    ["Status", <Badge tone={system.status === "active" ? "green" : "neutral"}>{system.status}</Badge>],
  ];
  return (
    <Section title="System details" subtitle="See your system information">
      {systems.length > 1 && (
        <Row label="Select system">
          <select value={system.id} onChange={(e) => selectSystem(e.target.value)} className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm">
            {systems.map((s) => (
              <option key={s.id} value={s.id}>
                {(s.system_name || s.solis_plant_name || "System").trim()} · {s.solis_station_id}
              </option>
            ))}
          </select>
        </Row>
      )}
      {items.map(([k, v]) => (
        <Row key={k} label={k}>
          <div className="text-sm text-neutral-800">{v}</div>
        </Row>
      ))}
      <p className="pt-5 text-sm text-neutral-500">Need to update any of these details? Submit a support ticket and our team will take care of it.</p>
    </Section>
  );
}

/* --------------------------------------------------------------- Documents */

const DOCUMENT_TYPES = ["Signed proposal", "Signed contract", "Signed IFC", "Certificate of energization"];

function DocumentsTab() {
  return (
    <Section title="Project documents" subtitle="Access all project-related files and documents">
      {DOCUMENT_TYPES.map((d) => (
        <Row key={d} label={d}>
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <FileText className="h-4 w-4" /> Not available in the portal yet
          </div>
        </Row>
      ))}
      <p className="pt-5 text-sm text-neutral-500">Your project documents will be published here once document delivery is connected. Until then, request a copy through a support ticket.</p>
    </Section>
  );
}

/* -------------------------------------------------------------------- FAQs */

function FaqsTab() {
  const [open, setOpen] = useState<number | null>(0);
  const [q, setQ] = useState("");
  const visible = FAQS.map((f, i) => ({ ...f, i })).filter((f) => !q || `${f.q} ${f.a}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Section title="Frequently asked questions">
      <div className="pt-5">
        <Input placeholder="Search FAQs" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md" />
      </div>
      <div className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200">
        {visible.map((f) => (
          <div key={f.i}>
            <button onClick={() => setOpen(open === f.i ? null : f.i)} className="flex w-full items-center justify-between py-4 text-left text-base font-semibold text-neutral-900">
              {f.i + 1}. {f.q}
              <ChevronDown className={`h-5 w-5 text-neutral-400 transition-transform ${open === f.i ? "rotate-180" : ""}`} />
            </button>
            {open === f.i && <p className="pb-4 text-sm leading-6 text-neutral-600">{f.a}</p>}
          </div>
        ))}
        {visible.length === 0 && <p className="py-6 text-sm text-neutral-500">No FAQs match your search.</p>}
      </div>
      <div className="mt-6 flex items-center gap-3 rounded-lg bg-neutral-50 p-4 text-sm text-neutral-600">
        <LifeBuoy className="h-5 w-5 text-brand-olive" /> Still need help?
        <Link to="/support/tickets/new">
          <Button size="sm" variant="secondary">
            Create a ticket
          </Button>
        </Link>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------- Legal */

function LegalTab({ title, meta, sections }: { title: string; meta: { version: string; updated: string }; sections: LegalSection[] }) {
  return (
    <Section title={title} subtitle={[meta.updated && `Last updated: ${meta.updated}`, meta.version && `Version: ${meta.version}`].filter(Boolean).join(" · ")}>
      <div className="prose-legal max-h-[70vh] overflow-y-auto pr-2 pt-2">
        {sections.map((s, i) => (
          <section key={i}>
            {s.heading && <h3>{s.heading}</h3>}
            {s.paragraphs.map((p, j) => (
              <p key={j}>{p}</p>
            ))}
          </section>
        ))}
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------- Page */

export default function AccountPage() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const current = (TABS.find((t) => t.id === tab)?.id ?? "profile") as TabId;
  return (
    <>
      <Breadcrumb items={[{ label: "Home", to: "/" }, { label: "My account" }]} />
      <PageHeader title="My account" subtitle="Update your information or access your documents" />
      <Tabs tabs={TABS} value={current} onChange={(id) => navigate(`/account/${id}`)} />
      {current === "profile" && <ProfileTab />}
      {current === "system" && <SystemTab />}
      {current === "documents" && <DocumentsTab />}
      {current === "faqs" && <FaqsTab />}
      {current === "terms" && <LegalTab title={TERMS_META.title} meta={TERMS_META} sections={TERMS} />}
      {current === "privacy" && <LegalTab title={PRIVACY_META.title} meta={PRIVACY_META} sections={PRIVACY} />}
    </>
  );
}
