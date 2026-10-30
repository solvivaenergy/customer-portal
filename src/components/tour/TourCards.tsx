import type { CSSProperties, ReactNode } from "react";
import { X } from "lucide-react";
import { Button, cx } from "@/components/ui";
import { SolvivaSunMark, WelcomeChargingIcon, WelcomeSavingsIcon, WelcomeSupportIcon } from "@/components/brand";

/*
 * The three cards of the onboarding tour (Figma "Intro Modal" and the "Onboarding Modal" set:
 * Tip 1–9, Skip, Finished). Presentational only — TourOverlay places them; DevPreviewPage shows
 * them without a login. `phone` switches to the phone variants from the designer's notes: the
 * welcome becomes a bottom sheet with stacked full-width buttons and the highlights get a
 * full-width "Got it".
 */

/** Desktop width of the tip and highlight cards (Figma: 370). */
export const TOUR_CARD_WIDTH = 370;

type Placed = { className?: string; style?: CSSProperties };

/** "Hi Coby, your solar is live!" — chartreuse header with a faint sun mark, three promises, two buttons. */
export function WelcomeCard({ name, phone, onStart, onLater, className, style }: { name: string; phone?: boolean; onStart: () => void; onLater: () => void } & Placed) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="tour-welcome-title" tabIndex={-1} className={cx("overflow-hidden bg-white shadow-lg outline-none", phone ? "rounded-t-[14px]" : "w-[517px] max-w-full rounded-[14px]", className)} style={style}>
      <div className="relative overflow-hidden bg-brand-chartreuse px-[30px] pt-[30px] pb-7">
        <SolvivaSunMark className="pointer-events-none absolute -right-[70px] top-[22px] h-56 w-56 text-brand-dark/10" />
        <h2 id="tour-welcome-title" className="relative text-[28px] font-bold leading-tight tracking-tight text-brand-dark sm:text-[30px]">
          Hi {name}, your solar is live!
        </h2>
        <p className="relative mt-3 text-base leading-6 text-neutral-900">This is your home for everything Solviva. Let us show you around. It only takes a minute.</p>
      </div>
      <div className="px-[30px] py-[30px]">
        <ul className="flex flex-col gap-[13px] text-base text-neutral-900">
          <li className="flex items-center gap-3.5">
            <WelcomeSavingsIcon className="h-6 w-6 shrink-0" /> See how much you’re saving
          </li>
          <li className="flex items-center gap-3.5">
            <WelcomeChargingIcon className="h-6 w-6 shrink-0" /> Track your solar and battery
          </li>
          <li className="flex items-center gap-3.5">
            <WelcomeSupportIcon className="h-6 w-6 shrink-0" /> Reach our team when you need help
          </li>
        </ul>
        {phone ? (
          <div className="mt-8 flex flex-col gap-2">
            <Button size="lg" full onClick={onStart} data-tour-primary>
              Show me around
            </Button>
            <Button variant="ghost" size="lg" full onClick={onLater}>
              Maybe later
            </Button>
          </div>
        ) : (
          <div className="mt-8 flex justify-end gap-2">
            <Button variant="ghost" onClick={onLater}>
              Maybe later
            </Button>
            <Button onClick={onStart} data-tour-primary>
              Show me around
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Dots({ count, active }: { count: number; active: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={cx("h-1.5 rounded-full transition-[width,background-color] duration-200", i === active ? "w-5 bg-brand-blue" : "w-1.5 bg-neutral-300")} />
      ))}
    </div>
  );
}

/** "Tip n of 9" — label pill, ×, title, body, progress dots, Back / Next (Finish on the last). */
export function TipCard({
  index,
  total,
  title,
  body,
  phone,
  onNext,
  onBack,
  onClose,
  className,
  style,
}: { index: number; total: number; title: string; body: ReactNode; phone?: boolean; onNext: () => void; onBack: () => void; onClose: () => void } & Placed) {
  const last = index === total - 1;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="tour-tip-title" tabIndex={-1} className={cx("rounded-[14px] bg-white p-5 shadow-lg outline-none", !phone && "w-[370px]", className)} style={style}>
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full bg-brand-chartreuse px-2.5 py-0.5 text-xs font-semibold text-brand-dark">
          Tip {index + 1} of {total}
        </span>
        <button onClick={onClose} className="-mr-1.5 -mt-1.5 rounded-md p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700" aria-label="Close the tour">
          <X className="h-5 w-5" />
        </button>
      </div>
      <h3 id="tour-tip-title" className="mt-3 text-lg font-semibold text-neutral-900">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600">{body}</p>
      <div className="mt-5 flex items-center justify-between gap-3">
        <Dots count={total} active={index} />
        <div className="flex items-center gap-1">
          {index > 0 && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              Back
            </Button>
          )}
          <Button size="sm" onClick={onNext} data-tour-primary>
            {last ? "Finish" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** The two highlights that point at the Get Started Tips button: "No problem" (closed early) and "You're all set" (finished). */
export function HighlightNote({ kind, name, phone, onDone, className, style }: { kind: "no-problem" | "all-set"; name: string; phone?: boolean; onDone: () => void } & Placed) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="tour-note-title" tabIndex={-1} className={cx("rounded-[14px] bg-white p-5 shadow-lg outline-none", !phone && "w-[370px]", className)} style={style}>
      <h3 id="tour-note-title" className="text-lg font-semibold text-neutral-900">
        {kind === "no-problem" ? `No problem, ${name}!` : "You’re all set!"}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600">
        {kind === "no-problem" ? (
          "Whenever you’re ready, the tour is right here."
        ) : (
          <>
            If you want to view these tips again, click <strong className="font-semibold text-neutral-800">Get Started Tips</strong> anytime.
          </>
        )}
      </p>
      <div className={cx("mt-5 flex", phone ? "flex-col" : "justify-end")}>
        <Button size={phone ? "lg" : "sm"} full={phone} onClick={onDone} data-tour-primary>
          Got it
        </Button>
      </div>
    </div>
  );
}
