import { Logo } from "@/components/Logo";
import { CoinsIcon, HandshakeIcon } from "@/components/icons";
import { Card } from "@/components/ui";
import { yearDivider, type SeriesPoint } from "@/lib/energy";
import { ConsumptionChart, SavingsChart } from "./home/charts";

/** Development-only page (route /dev/preview, not in the production bundle) to eyeball brand pieces and charts without signing in. */
const MONTHS = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"];
const SAMPLE: SeriesPoint[] = MONTHS.map((label, i) => {
  const key = i < 2 ? `2025-${11 + i}` : `2026-${String(i - 1).padStart(2, "0")}`;
  const production = 400 + Math.round(300 * Math.sin((i / 12) * Math.PI));
  return { key, label, production, consumption: production + 120, grid: 150, solar: production - 80, battery: 50, savings: production * 14.7, hasData: true };
});

export default function DevPreviewPage() {
  const divider = yearDivider(SAMPLE);
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
