import { useMemo, useRef, useState, type CSSProperties } from "react";
import { Check, Copy, Facebook, Instagram, Linkedin, Send, Twitter } from "lucide-react";
import { Button, Modal, Overlay, cx, usePresence } from "@/components/ui";
import { php } from "@/lib/format";
import { REFERRAL } from "@/content/contact";

export type ShareKind = "savings" | "referral";

export function shareText(kind: ShareKind, amount: number, since: string | null, code: string | null) {
  const codePart = code ? ` Use my referral code ${code} to sign up.` : "";
  if (kind === "savings") return `Yay! I saved ${php(amount)} since switching to solar${since ? ` in ${since}` : ""}.${codePart}`;
  return `Yay! I earned ${php(amount, { decimals: 0 })} by helping someone make the switch to solar.${codePart}`;
}

/** Referral landing page is not built yet — the link goes to the website with the code as a query parameter. */
export const referralLink = (code: string | null) => `${REFERRAL.landingUrl}${code ? `?ref=${encodeURIComponent(code)}` : ""}`;

function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-neutral-700">{label}</p>
      <div className="flex items-center gap-2">
        <input readOnly value={value} className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-700" onFocus={(e) => e.currentTarget.select()} />
        <button type="button" onClick={copy} className="rounded-lg border border-neutral-300 p-2 text-neutral-600 hover:bg-neutral-50" aria-label="Copy">
          {copied ? <Check className="h-4 w-4 text-green-700" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function ShareModal({ open, onClose, kind, amount, since, code }: { open: boolean; onClose: () => void; kind: ShareKind; amount: number; since: string | null; code: string | null }) {
  const text = shareText(kind, amount, since, code);
  const link = referralLink(code);
  const enc = encodeURIComponent;
  const targets = [
    { name: "Facebook", icon: <Facebook className="h-5 w-5" />, href: `https://www.facebook.com/sharer/sharer.php?u=${enc(link)}&quote=${enc(text)}` },
    { name: "Instagram", icon: <Instagram className="h-5 w-5" />, href: null },
    { name: "X", icon: <Twitter className="h-5 w-5" />, href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(link)}` },
    { name: "LinkedIn", icon: <Linkedin className="h-5 w-5" />, href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(link)}` },
    { name: "Telegram", icon: <Send className="h-5 w-5" />, href: `https://t.me/share/url?url=${enc(link)}&text=${enc(text)}` },
  ];
  const nativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  return (
    <Modal open={open} onClose={onClose} title="Share">
      <p className="text-sm text-neutral-600">{text}</p>
      <div className="mt-5 flex flex-col gap-4">
        {kind === "savings" ? <CopyField label="Share link" value={link} /> : <CopyField label="Share referral code" value={code ?? "No referral code yet"} />}
        <div>
          <p className="mb-2 text-sm font-medium text-neutral-700">Share to</p>
          <div className="flex items-center gap-2">
            {targets.map((t) =>
              t.href ? (
                <a key={t.name} href={t.href} target="_blank" rel="noreferrer" title={t.name} className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 hover:bg-neutral-50">
                  {t.icon}
                </a>
              ) : (
                <button key={t.name} type="button" title={`${t.name}: copy the text and paste it in the app`} onClick={() => navigator.clipboard.writeText(`${text} ${link}`)} className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 hover:bg-neutral-50">
                  {t.icon}
                </button>
              ),
            )}
          </div>
        </div>
        {nativeShare && (
          <Button variant="secondary" onClick={() => navigator.share({ text, url: link }).catch(() => undefined)}>
            More options…
          </Button>
        )}
      </div>
    </Modal>
  );
}

// Pieces fly over the card as well as the backdrop, and on a phone the card is the whole screen, so no
// piece may share the card's own colour (chartreuse for savings, royal blue for referrals).
const CONFETTI_COLORS = { savings: ["#508908", "#1f522b", "#15803d", "#8be114"], referral: ["#00a7ea", "#d2ff1e", "#ffffff", "#8be114"] };

/** Small seeded PRNG (mulberry32) so a burst is random but stable across re-renders. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SHAPES = ["", "confetti-piece--round", "confetti-piece--strip"];

/** Pieces per burst: a phone screen is mostly card, a desktop has far more room around the modal. */
const BASE_COUNT = 130;
function confettiCount() {
  const w = typeof window === "undefined" ? 0 : window.innerWidth;
  return w >= 1024 ? 340 : w >= 640 ? 220 : BASE_COUNT;
}

/**
 * One burst of confetti from the centre of the screen, random in every respect (direction, reach,
 * size, shape, spin, timing). The reach is measured in vw horizontally and vh vertically, so the burst
 * fills a phone screen as well as a desktop one instead of staying hidden behind the card. The first
 * 130 pieces leave within 140 ms (the burst itself); any extra pieces on wider screens follow over the
 * next half second, so the celebration reads fuller and lasts a little longer rather than just denser.
 */
function confettiPieces(kind: ShareKind, seed: number, count = BASE_COUNT) {
  const colors = CONFETTI_COLORS[kind];
  const r = rng(seed);
  return Array.from({ length: count }, (_, i) => {
    const angle = r() * Math.PI * 2;
    const reach = 12 + r() * 48; // 12–60% of the viewport in that direction
    const delay = i < BASE_COUNT ? r() * 140 : 80 + r() * 420;
    return {
      shape: SHAPES[Math.floor(r() * SHAPES.length)],
      style: {
        "--dx": `${(Math.cos(angle) * reach).toFixed(1)}vw`,
        "--dy": `${(Math.sin(angle) * reach).toFixed(1)}vh`,
        "--drop": `${(8 + r() * 28).toFixed(0)}vh`,
        "--spin": `${(r() < 0.5 ? -1 : 1) * Math.round(360 + r() * 720)}deg`,
        "--size": (0.7 + r() * 0.7).toFixed(2),
        animationDelay: `${Math.round(delay)}ms`,
        animationDuration: `${(1.4 + r() * 0.9).toFixed(2)}s`,
        background: colors[Math.floor(r() * colors.length)],
      } as CSSProperties,
    };
  });
}

export function CelebrationOverlay({ open, onClose, kind, amount, since, onShare }: { open: boolean; onClose: () => void; kind: ShareKind; amount: number; since: string | null; onShare: () => void }) {
  const { mounted, exiting } = usePresence(open, 180);
  // A fresh random burst each time the overlay opens, sized for the screen it opens on; the seed is
  // fixed while it is up so re-renders don't reshuffle it.
  const seed = useRef(0);
  const wasOpen = useRef(false);
  if (open && !wasOpen.current) seed.current = Math.floor(Math.random() * 2 ** 32);
  wasOpen.current = open;
  const pieces = useMemo(() => confettiPieces(kind, seed.current, confettiCount()), [kind, seed.current]);
  if (!mounted) return null;
  const isSavings = kind === "savings";
  return (
    <Overlay>
      <div className={cx("fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-neutral-900/70 sm:p-4", exiting ? "anim-fade-out" : "anim-fade-in")} onClick={onClose}>
        {/* On a phone the card is the whole screen (Figma "Savings pop up"); from sm up it is a centred modal.
            The confetti comes after it in the DOM so the pieces fly over it; they ignore pointer events. */}
        <div className={cx("relative flex h-full w-full flex-col justify-center p-8 text-center sm:h-auto sm:max-w-md sm:rounded-2xl sm:shadow-lg", isSavings ? "bg-brand-chartreuse text-brand-dark" : "bg-brand-blue text-white", exiting ? "anim-pop-out" : "anim-pop-in")} onClick={(e) => e.stopPropagation()}>
          <h2 className="text-3xl font-semibold sm:text-2xl">
            {isSavings ? "You saved " : "You earned "}
            <span className={isSavings ? "text-brand-blue" : "text-brand-chartreuse"}>{php(amount, { decimals: isSavings ? 2 : 0 })}</span>
            {isSavings ? " with solar!" : " with your referrals"}
          </h2>
          <p className={`mt-3 text-sm ${isSavings ? "text-brand-dark/80" : "text-white/85"}`}>
            {isSavings ? `Yay! You've saved a lot since switching to solar${since ? ` in ${since}` : ""}. Share this with your friends!` : "Yay! You helped someone make the switch to solar. Spread the word and keep earning."}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button variant={isSavings ? "dark" : "accent"} size="lg" onClick={onShare}>
              {isSavings ? "Share" : "Share referral code"}
            </Button>
            <button onClick={onClose} className={`py-2 text-sm font-semibold ${isSavings ? "text-brand-dark/80" : "text-white/85"} hover:underline`}>
              Close
            </button>
          </div>
        </div>
        {pieces.map((p, i) => (
          <span key={i} className={cx("confetti-piece", p.shape)} style={p.style} aria-hidden="true" />
        ))}
      </div>
    </Overlay>
  );
}
