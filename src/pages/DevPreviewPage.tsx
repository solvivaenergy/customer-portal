import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { CoinsIcon, HandshakeIcon, PhoneCallIcon, PmsToolsIcon, SupportTicketIcon } from "@/components/icons";
import { Badge, Card, Segmented, Tabs } from "@/components/ui";
import { yearDivider, type SeriesPoint } from "@/lib/energy";
import { ConsumptionChart, SavingsChart } from "./home/charts";
import { CelebrationOverlay } from "./home/share";
import { PmsSteps } from "./support/PmsRequestPage";
import { HighlightNote, TipCard, WelcomeCard } from "@/components/tour/TourCards";
import { TourOverlay } from "@/components/tour/TourOverlay";
import { TOUR_STEPS, TourContext, type TourStage, type TourState } from "@/lib/tour";
import { Home, LifeBuoy, Lightbulb, Menu } from "lucide-react";
import { Button } from "@/components/ui";

/**
 * Development-only page (route /dev/preview, not in the production bundle) to eyeball brand pieces and
 * charts without signing in. `?screen=celebrate|celebrate-referral|mobile` previews the phone-layout
 * pieces (celebration overlay, account tabs, PMS steps, activities switch) — open at a 400px width.
 * `?screen=tour` shows the onboarding tour's cards (desktop and phone variants) on the dim backdrop;
 * `?screen=tour-demo&stage=welcome|tip-0…tip-8|no-problem|all-set` runs the real overlay over a
 * stand-in page that carries every data-tour element (all on one page, no routing), driven by local
 * state instead of the login — Next/Back/×/Got it work as in the portal.
 */
function parseStage(raw: string | null): TourStage {
  if (!raw || raw === "idle") return { kind: "idle" };
  if (raw.startsWith("tip-")) return { kind: "tip", index: Math.min(TOUR_STEPS.length - 1, Math.max(0, Number(raw.slice(4)) || 0)) };
  if (raw === "welcome" || raw === "no-problem" || raw === "all-set") return { kind: raw };
  return { kind: "idle" };
}

function TourDemo({ initial }: { initial: TourStage }) {
  const [stage, setStage] = useState<TourStage>(initial);
  const [open, setOpen] = useState(false);
  const goTo = (index: number) => setStage({ kind: "tip", index });
  const value: TourState = {
    stage,
    steps: TOUR_STEPS,
    firstName: "Coby",
    wantsDrawer: stage.kind === "tip" && !!TOUR_STEPS[stage.index].drawer,
    start: () => goTo(0),
    next: () => (stage.kind === "tip" ? (stage.index + 1 < TOUR_STEPS.length ? goTo(stage.index + 1) : setStage({ kind: "all-set" })) : undefined),
    back: () => stage.kind === "tip" && stage.index > 0 && goTo(stage.index - 1),
    dismiss: () => setStage({ kind: "no-problem" }),
    finish: () => setStage({ kind: "all-set" }),
    acknowledge: () => setStage({ kind: "idle" }),
  };
  const sidebar = (
    <div className="flex h-full flex-col bg-brand-dark px-4 py-6 text-white">
      <div className="px-2">
        <Logo size="xl" />
      </div>
      <nav className="mt-10 flex flex-col gap-1">
        <a data-tour="nav-home" className="flex items-center gap-3 rounded-lg bg-white/15 px-4 py-3 text-base font-semibold">
          <Home className="h-5 w-5" /> Home
        </a>
        <a data-tour="nav-support" className="flex items-center gap-3 rounded-lg px-4 py-3 text-base font-semibold text-white/90">
          <LifeBuoy className="h-5 w-5" /> Support
        </a>
      </nav>
      <div className="mt-auto">
        <div className="my-5 border-t border-white/20" />
        <a data-tour="profile" className="flex items-center gap-3 rounded-lg px-2 py-1">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light text-sm font-semibold text-brand-dark">CC</span>
          <span className="text-sm font-semibold">Coby Cobankiat</span>
        </a>
      </div>
    </div>
  );
  const drawerOpen = open || value.wantsDrawer;
  return (
    <TourContext.Provider value={value}>
      <div className="min-h-screen lg:flex">
        <aside className="hidden w-[296px] shrink-0 lg:block">
          <div className="sticky top-0 h-screen">{sidebar}</div>
        </aside>
        <div className="flex items-center justify-between bg-brand-dark px-4 py-3 lg:hidden">
          <Logo size="lg" />
          <button onClick={() => setOpen(true)} data-tour="menu" className="rounded-md p-2 text-white" aria-label="Open menu">
            <Menu className="h-6 w-6" />
          </button>
        </div>
        {drawerOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-neutral-900/50" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-[296px] shadow-lg">{sidebar}</div>
          </div>
        )}
        <main className="min-w-0 flex-1">
          <div className="max-w-[1120px] px-4 py-6 sm:px-8 sm:py-8">
            <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3 lg:justify-end">
              <Button variant="secondary" onClick={() => goTo(0)} data-tour="get-started" className="font-semibold">
                <Lightbulb className="h-4 w-4 text-neutral-500" /> Get Started Tips
              </Button>
              <span className="text-sm text-neutral-700">30°C · Makati City</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Good afternoon, Coby</h1>
            <p className="mt-1 mb-6 text-base text-neutral-500">Track and manage your solar savings</p>
            <div className="grid gap-6 lg:grid-cols-[1fr_304px]">
              <Card tour="savings">
                <p className="text-base text-neutral-600">Total savings from Solar</p>
                <p className="mt-1 text-4xl font-semibold text-neutral-900">₱83,204.21</p>
                <div className="mt-6">
                  <SavingsChart points={SAMPLE} divider={yearDivider(SAMPLE)} />
                </div>
              </Card>
              <div className="flex flex-col gap-4">
                <Card>
                  <p className="text-base text-neutral-600">Total savings from solar</p>
                  <p className="mt-2 text-2xl font-semibold text-neutral-900">₱83,204.21</p>
                </Card>
                <div className="rounded-xl bg-brand-chartreuse p-6">
                  <p className="text-lg font-semibold text-brand-blue">Refer and Earn</p>
                </div>
              </div>
            </div>
            <h2 className="mb-4 mt-10 text-2xl font-semibold text-neutral-900">Your system's performance</h2>
            <div className="grid gap-6 lg:grid-cols-[1fr_304px]">
              <Card tour="performance">
                <p className="text-base font-semibold text-neutral-700">Total consumption</p>
                <p className="mt-1 text-3xl font-semibold text-neutral-900">26,391 kWh</p>
                <div className="mt-6">
                  <ConsumptionChart points={SAMPLE} hasConsumption divider={yearDivider(SAMPLE)} />
                </div>
              </Card>
              <div className="flex flex-col gap-4">
                <Card>
                  <p className="text-base text-neutral-600">Total consumption</p>
                  <p className="mt-2 text-2xl font-semibold text-neutral-900">26,391 kWh</p>
                </Card>
                <Card tour="battery">
                  <p className="text-base font-semibold text-neutral-800">Battery charging</p>
                  <div className="relative mt-4 h-10 overflow-hidden rounded-lg bg-neutral-200">
                    <div className="h-full w-[70%] bg-brand-chartreuse" />
                    <span className="absolute inset-y-0 left-3 flex items-center text-lg font-semibold text-brand-dark">70%</span>
                  </div>
                  <p className="mt-3 text-sm text-neutral-600">5 kWh battery</p>
                </Card>
              </div>
            </div>
            <h2 className="mb-4 mt-10 text-2xl font-semibold text-neutral-900">Support and Helpdesk</h2>
            <div className="grid gap-5 md:grid-cols-3">
              {[
                ["ticket", <SupportTicketIcon className="h-12 w-12" />, "Submit a support ticket"],
                ["pms", <PmsToolsIcon className="h-12 w-12" />, "Request PMS"],
                ["contact", <PhoneCallIcon className="h-12 w-12" />, "Contact support"],
              ].map(([id, icon, title]) => (
                <Card key={id as string} tour={id as string}>
                  {icon}
                  <p className="mt-6 text-xl font-semibold text-neutral-900">{title}</p>
                  <p className="mt-1 text-sm text-neutral-500">Reach out to our team for assistance.</p>
                </Card>
              ))}
            </div>
          </div>
        </main>
        <TourOverlay />
      </div>
    </TourContext.Provider>
  );
}

function TourPieces() {
  const noop = () => undefined;
  const step = TOUR_STEPS[1];
  return (
    <div className="flex min-h-screen flex-col gap-10 bg-[rgb(16_24_40_/_0.55)] p-6">
      <section className="flex flex-wrap items-start gap-6">
        <WelcomeCard name="Coby" onStart={noop} onLater={noop} />
        <div className="w-[360px] overflow-hidden rounded-[14px]">
          <WelcomeCard name="Coby" phone onStart={noop} onLater={noop} />
        </div>
      </section>
      <section className="flex flex-wrap items-start gap-6">
        <TipCard index={1} total={TOUR_STEPS.length} title={step.title} body={step.body} onNext={noop} onBack={noop} onClose={noop} />
        <TipCard index={8} total={TOUR_STEPS.length} title={TOUR_STEPS[8].title} body={TOUR_STEPS[8].body} onNext={noop} onBack={noop} onClose={noop} />
        <div className="w-[344px]">
          <TipCard index={0} total={TOUR_STEPS.length} title={TOUR_STEPS[0].title} body={TOUR_STEPS[0].body} phone onNext={noop} onBack={noop} onClose={noop} />
        </div>
      </section>
      <section className="flex flex-wrap items-start gap-6">
        <HighlightNote kind="no-problem" name="Coby" onDone={noop} />
        <HighlightNote kind="all-set" name="Coby" onDone={noop} />
        <div className="w-[328px]">
          <HighlightNote kind="all-set" name="Coby" phone onDone={noop} />
        </div>
      </section>
    </div>
  );
}

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
  const production = 1600 + Math.round(1200 * Math.sin((i / 12) * Math.PI)); // four-digit ticks, like a real year
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
  if (screen === "tour") return <TourPieces />;
  if (screen === "tour-demo") return <TourDemo initial={parseStage(params.get("stage"))} />;
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
          <ConsumptionChart points={SAMPLE} hasConsumption divider={divider} xLabel="Month" />
        </Card>
      </div>
    </div>
  );
}
