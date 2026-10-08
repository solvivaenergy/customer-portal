import { Link, useLocation } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Breadcrumb } from "@/layout/Breadcrumb";
import { Button, Card } from "@/components/ui";

export default function SubmissionSuccessPage() {
  const state = useLocation().state as { kind?: "ticket" | "pms"; dryRun?: boolean } | null;
  const isPms = state?.kind === "pms";
  return (
    <>
      <Breadcrumb items={[{ label: "Home", to: "/" }, { label: "Support", to: "/support" }, { label: isPms ? "Request PMS" : "Submit a ticket" }]} />
      <Card className="mx-auto max-w-xl py-16 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-brand-absinthe" />
        <h1 className="mt-6 text-2xl font-semibold text-neutral-900">{isPms ? "Request submitted" : "Support ticket created"}</h1>
        <p className="mx-auto mt-2 max-w-sm text-base text-neutral-500">
          {isPms ? "Your request has been created. Our team is looking into it and will reach out to you as soon as possible." : "Your support ticket has been created. Our team is looking into it and will reach out to you as soon as possible."}
        </p>
        {state?.dryRun && <p className="mx-auto mt-4 max-w-sm rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">Development mode: submissions are disabled, nothing was sent to Odoo.</p>}
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/support">
            <Button variant="secondary">Back to Support</Button>
          </Link>
          <Link to="/">
            <Button>Go to Home</Button>
          </Link>
        </div>
      </Card>
    </>
  );
}
