import { Coins, Handshake, type LucideIcon } from "lucide-react";
import { cx } from "./ui";

/**
 * Duotone rendering in the mockup's style: lime-filled shapes with a dark-green outline.
 * The same line icon is stacked twice — a chartreuse copy underneath (thick stroke, and a fill
 * so closed shapes read as solid), a thin dark-green copy on top for the outline.
 */
export function DuotoneIcon({ icon: Icon, className, fill = true, children }: { icon: LucideIcon; className?: string; fill?: boolean; children?: React.ReactNode }) {
  return (
    <span className={cx("relative inline-block", className)} aria-hidden="true">
      <Icon className="absolute inset-0 h-full w-full text-brand-chartreuse" strokeWidth={3.5} strokeLinejoin="round" strokeLinecap="round" fill={fill ? "currentColor" : "none"} />
      <Icon className="relative h-full w-full text-brand-dark" strokeWidth={1.5} />
      {children}
    </span>
  );
}

function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className={cx("absolute text-brand-dark", className)}>
      <path d="M12 3v7M12 14v7M3 12h7M14 12h7" />
    </svg>
  );
}

/** Coins with sparkles — "Total savings from solar" card. */
export function CoinsIcon({ className }: { className?: string }) {
  return (
    <span className={cx("relative inline-block", className)}>
      <DuotoneIcon icon={Coins} className="h-full w-full" />
      <Sparkle className="-left-2 -top-2 h-3.5 w-3.5" />
      <Sparkle className="-right-1.5 -top-1 h-2.5 w-2.5" />
    </span>
  );
}

/** Handshake — "Referral earnings" card. */
export function HandshakeIcon({ className }: { className?: string }) {
  return <DuotoneIcon icon={Handshake} className={className} />;
}
