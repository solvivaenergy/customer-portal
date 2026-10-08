import { Link, useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { Breadcrumb } from "@/layout/Breadcrumb";
import { Button, Card, PageHeader } from "@/components/ui";
import { PMS } from "@/content/contact";

export default function PmsIntroPage() {
  const navigate = useNavigate();
  return (
    <>
      <Breadcrumb items={[{ label: "Home", to: "/" }, { label: "Support", to: "/support" }, { label: "Request PMS" }]} />
      <PageHeader title="Request PMS" subtitle="Fill out this form to request a Preventive Maintenance Service (PMS) for your system. Our team will reach out to you to coordinate the schedule." />
      <Card className="max-w-3xl">
        <h3 className="text-lg font-semibold text-neutral-900">Here's what's included in our PMS</h3>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {PMS.inclusions.map((i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-olive" /> {i}
            </li>
          ))}
        </ul>
        <h3 className="mt-8 text-lg font-semibold text-neutral-900">How much does it cost?</h3>
        <p className="mt-2 text-sm text-neutral-600">{PMS.pricing}</p>
      </Card>
      <div className="mt-6 flex max-w-3xl justify-end gap-3">
        <Link to="/support">
          <Button variant="ghost">Cancel</Button>
        </Link>
        <Button onClick={() => navigate("/support/pms/request")}>I understand, proceed</Button>
      </div>
    </>
  );
}
