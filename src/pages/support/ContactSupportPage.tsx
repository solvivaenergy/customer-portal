import { useState } from "react";
import { Check, Clock, Copy, Mail, MapPin, Phone } from "lucide-react";
import { Breadcrumb } from "@/layout/Breadcrumb";
import { Card, PageHeader } from "@/components/ui";
import { CONTACT } from "@/content/contact";

function PhoneRow({ label, phone, tel }: { label: string; phone: string; tel: string }) {
  return (
    <div>
      <p className="text-sm text-neutral-500">{label}:</p>
      <a href={`tel:${tel}`} className="mt-1 flex items-center gap-2 text-lg font-semibold text-neutral-900 hover:text-brand-blue">
        <Phone className="h-5 w-5 text-brand-absinthe" /> {phone}
      </a>
      <p className="mt-0.5 text-xs text-neutral-500">Available {CONTACT.hotlineAvailability}</p>
    </div>
  );
}

/** One mailbox with what it is for and a copy button (CX's descriptions, 2026-11-10). */
function EmailRow({ label, address }: { label: string; address: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <li className="flex items-start gap-3">
      <Mail className="mt-0.5 h-5 w-5 shrink-0 text-neutral-500" />
      <div className="min-w-0">
        <p className="text-sm text-neutral-500">{label}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <a href={`mailto:${address}`} className="break-all text-brand-blue hover:underline">
            {address}
          </a>
          <button onClick={copy} className="rounded-md border border-neutral-300 p-1.5 text-neutral-500 hover:bg-neutral-50" aria-label={`Copy ${address}`}>
            {copied ? <Check className="h-4 w-4 text-green-700" /> : <Copy className="h-4 w-4" />}
          </button>
          {copied && <span className="text-sm text-green-700">Copied</span>}
        </div>
      </div>
    </li>
  );
}

export default function ContactSupportPage() {
  return (
    <>
      <Breadcrumb items={[{ label: "Home", to: "/" }, { label: "Support", to: "/support" }, { label: "Contact support" }]} />
      <PageHeader title="Contact support" subtitle={`Our hotline is available ${CONTACT.hotlineAvailability}.`} />
      <div className="anim-fade-up">
        <Card className="max-w-3xl">
          <PhoneRow label={CONTACT.technical.label} phone={CONTACT.technical.phone} tel={CONTACT.technical.tel} />
          <div className="my-8 border-t border-neutral-200" />
          <ul className="flex flex-col gap-5 text-base text-neutral-700">
            <li className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-neutral-500" />
              <span>{CONTACT.address}</span>
            </li>
            {CONTACT.emails.map((e) => (
              <EmailRow key={e.address} label={e.label} address={e.address} />
            ))}
            <li className="flex items-center gap-3">
              <Clock className="h-5 w-5 shrink-0 text-neutral-500" />
              <span>Office hours: {CONTACT.officeHours}</span>
            </li>
          </ul>
        </Card>
      </div>
    </>
  );
}
