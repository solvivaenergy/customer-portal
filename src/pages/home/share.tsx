import { useState } from "react";
import { Check, Copy, Facebook, Instagram, Linkedin, Send, Twitter } from "lucide-react";
import { Button, Modal } from "@/components/ui";
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

const CONFETTI_COLORS = { savings: ["#8be114", "#d2ff1e", "#def0d8", "#15803d"], referral: ["#006ac6", "#00a7ea", "#d2ff1e", "#ffffff"] };

export function CelebrationOverlay({ open, onClose, kind, amount, since, onShare }: { open: boolean; onClose: () => void; kind: ShareKind; amount: number; since: string | null; onShare: () => void }) {
  if (!open) return null;
  const pieces = Array.from({ length: 60 }, (_, i) => ({
    left: `${(i * 37) % 100}%`,
    delay: `${(i % 12) * 0.35}s`,
    duration: `${4 + (i % 5)}s`,
    color: CONFETTI_COLORS[kind][i % 4],
  }));
  const isSavings = kind === "savings";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-neutral-900/70 p-4" onClick={onClose}>
      {pieces.map((p, i) => (
        <span key={i} className="confetti-piece" style={{ left: p.left, animationDelay: p.delay, animationDuration: p.duration, background: p.color }} />
      ))}
      <div className={`relative w-full max-w-md rounded-2xl p-8 text-center shadow-lg ${isSavings ? "bg-brand-chartreuse text-brand-dark" : "bg-brand-blue text-white"}`} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-semibold">
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
    </div>
  );
}
