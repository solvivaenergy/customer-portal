import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { CoinsIcon, HandshakeIcon, PhoneCallIcon, PmsToolsIcon, SupportTicketIcon } from "@/components/icons";
import { Badge, Card, Segmented, Tabs } from "@/components/ui";
import { yearDivider, type SeriesPoint } from "@/lib/energy";
import { ConsumptionChart, SavingsChart } from "./home/charts";
import { CelebrationOverlay } from "./home/share";
import { PmsSteps } from "./support/PmsRequestPage";

/**
 * Development-only page (route /dev/preview, not in the production bundle) to eyeball brand pieces and
 * charts without signing in. `?screen=celebrate|celebrate-referral|mobile` previews the phone-layout
 * pieces (celebration overlay, account tabs, PMS steps, activities switch) — open at a 400px width.
 */
function MobilePieces() {
  const [tab, setTab] = useState("privacy");
  const [kind, setKind] = useState("support");
  return (
    <div className="flex flex-col gap-10 p-4">
      <section>
        <p className="mb-3 text-sm font-semibold text-neutral-700">Account tabs (active: Privacy Policy, scrolled into view, no scrollbar)</p>
        <Tabs
          tabs={[
            { id: "profile", label: "My profile" },
            { id: "system", label: "System details" },
            { id: "faqs", label: "FAQs" },
            { id: "terms", label: "Terms and Conditions" },
            { id: "privacy", label: "Privacy Policy" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </section>
      <section>
        <p className="mb-3 text-sm font-semibold text-neutral-700">PMS steps (step 2 active)</p>
        <Card>
          <PmsSteps step={1} />
        </Card>
      </section>
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-4">
          <h2 className="text-2xl font-semibold text-neutral-900 sm:basis-full">My activities</h2>
          <Segmented
            options={[
              { id: "support", label: "Support" },
              { id: "pms", label: "PMS" },
            ]}
            value={kind}
            onChange={setKind}
            stretch
            className="order-last basis-full sm:order-none sm:basis-auto"
          />
          <span className="ml-auto text-sm font-semibold text-neutral-600 sm:order-last">Refresh</span>
        </div>
        <Card padded={false} className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-100 text-neutral-700">
              <tr>
                <th className="px-4 py-3 font-medium md:px-6">Ticket No.</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell md:px-6">Subject</th>
                <th className="px-4 py-3 font-medium md:px-6">Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["CS7263", "In Progress", "amber"],
                ["CS1837", "In Progress", "amber"],
                ["AS7261", "Resolved", "green"],
              ].map(([ref, status, tone]) => (
                <tr key={ref} className="cursor-pointer border-t border-neutral-200 hover:bg-neutral-50">
                  <td className="px-4 py-4 font-medium text-neutral-900 md:px-6">{ref}</td>
                  <td className="hidden px-4 py-4 md:table-cell md:px-6">System Performance Review</td>
                  <td className="px-4 py-4 md:px-6">
                    <Badge tone={tone as "amber" | "green"}>{status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}
const MONTHS = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"];
const SAMPLE: SeriesPoint[] = MONTHS.map((label, i) => {
  const key = i < 2 ? `2025-${11 + i}` : `2026-${String(i - 1).padStart(2, "0")}`;
  const production = 400 + Math.round(300 * Math.sin((i / 12) * Math.PI));
  return { key, label, production, consumption: production + 120, grid: 150, solar: production - 80, battery: 50, exported: 0, savings: production * 14.7, hasData: true };
});

export default function DevPreviewPage() {
  const [params] = useSearchParams();
  const screen = params.get("screen");
  const divider = yearDivider(SAMPLE);
  if (screen === "celebrate" || screen === "celebrate-referral") {
    const kind = screen === "celebrate" ? "savings" : "referral";
    return <CelebrationOverlay open onClose={() => undefined} kind={kind} amount={kind === "savings" ? 83204.21 : 10000} since="January 2025" onShare={() => undefined} />;
  }
  if (screen === "mobile") return <MobilePieces />;
  return (
    <div className="flex min-h-screen flex-col gap-8 bg-[#fcfcfc] p-8">
      <div className="flex gap-8">
        <div className="w-[296px] rounded-xl bg-brand-dark px-6 py-6">
          <Logo />
        </div>
        <div className="flex w-[304px] flex-col gap-4">
          <Card>
            <div className="flex items-start justify-between">
              <p className="text-base text-neutral-600">Total savings from solar</p>
              <CoinsIcon className="h-8 w-8" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-neutral-900">₱83,204.21</p>
          </Card>
          <Card>
            <div className="flex items-start justify-between">
              <p className="text-base text-neutral-600">Referral earnings</p>
              <HandshakeIcon className="h-8 w-8" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-neutral-900">₱10,000</p>
          </Card>
          <div className="rounded-xl bg-white p-6 shadow-xs">
            <Logo variant="dark" size="lg" linkTo={null} />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          {[
            [<SupportTicketIcon className="h-12 w-12" />, "Submit a support ticket"],
            [<PmsToolsIcon className="h-12 w-12" />, "Request PMS"],
            [<PhoneCallIcon className="h-12 w-12" />, "Contact support"],
          ].map(([icon, title], i) => (
            <Card key={i} className="w-[300px]">
              {icon}
              <p className="mt-5 text-xl font-semibold text-neutral-900">{title}</p>
            </Card>
          ))}
        </div>
      </div>
      <div className="grid max-w-[1120px] gap-6 lg:grid-cols-2">
        <Card>
          <p className="mb-4 text-sm font-semibold text-neutral-700">Savings — 1Y with year divider</p>
          <SavingsChart points={SAMPLE} divider={divider} />
        </Card>
        <Card>
          <p className="mb-4 text-sm font-semibold text-neutral-700">Consumption — 1Y with year divider</p>
          <ConsumptionChart points={SAMPLE} hasConsumption divider={divider} />
        </Card>
      </div>
    </div>
  );
}
