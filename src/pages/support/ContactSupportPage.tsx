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
      <p className="mt-0.5 text-xs text-neutral-500">Available {CONTACT.hotlineHours}</p>
    </div>
  );
}

export default function ContactSupportPage() {
  const [copied, setCopied] = useState(false);
  const copyEmail = async () => {
    await navigator.clipboard.writeText(CONTACT.email);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <>
      <Breadcrumb items={[{ label: "Home", to: "/" }, { label: "Support", to: "/support" }, { label: "Contact support" }]} />
      <PageHeader title="Contact support" subtitle={`Our hotline is available ${CONTACT.hotlineHours}.`} />
      <Card className="max-w-3xl">
        <div className="grid gap-8 sm:grid-cols-2">
          <PhoneRow label={CONTACT.nonTechnical.label} phone={CONTACT.nonTechnical.phone} tel={CONTACT.nonTechnical.tel} />
          <PhoneRow label={CONTACT.technical.label} phone={CONTACT.technical.phone} tel={CONTACT.technical.tel} />
        </div>
        <div className="my-8 border-t border-neutral-200" />
        <ul className="flex flex-col gap-5 text-base text-neutral-700">
          <li className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-neutral-500" />
            <span>{CONTACT.address}</span>
          </li>
          <li className="flex items-center gap-3">
            <Mail className="h-5 w-5 shrink-0 text-neutral-500" />
            <a href={`mailto:${CONTACT.email}`} className="text-brand-blue hover:underline">
              {CONTACT.email}
            </a>
            <button onClick={copyEmail} className="rounded-md border border-neutral-300 p-1.5 text-neutral-500 hover:bg-neutral-50" aria-label="Copy email">
              {copied ? <Check className="h-4 w-4 text-green-700" /> : <Copy className="h-4 w-4" />}
            </button>
            {copied && <span className="text-sm text-green-700">Copied</span>}
          </li>
          <li className="flex items-center gap-3">
            <Clock className="h-5 w-5 shrink-0 text-neutral-500" />
            <span>Operating hours: {CONTACT.officeHours}</span>
          </li>
        </ul>
      </Card>
    </>
  );
}
