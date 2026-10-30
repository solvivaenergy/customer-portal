import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { useAuth } from "@/auth/AuthProvider";
import { usePortal } from "./portal";
import { firstName } from "./format";

/**
 * Guided tour of the portal — Figma "Onboarding v2 (With “Get Started Tips” button)", designer notes
 * dated 2026-10-29. A welcome modal on the customer's first login offers the tour; nine tips then
 * ring one element each on the Home and Support pages (Back / Next / ×, Finish on the last); closing
 * early shows "No problem" and finishing shows "You're all set", both pointing at the Get Started
 * Tips button in the header, which replays the tour from any page (going Home first). Whether the
 * customer has already seen it is stored in the Supabase Auth user metadata (`portal_tour`), with
 * localStorage as a fallback, so the welcome shows once per account rather than once per device.
 * The overlay itself is components/tour/TourOverlay.tsx; elements are found by `data-tour="<id>"`.
 */

export type TourPlacement = "right" | "left" | "bottom";
export type TourStep = {
  /** `data-tour` value of the element the tip rings. */
  id: string;
  /** Page the element lives on; the tour navigates there first. */
  route: string;
  title: string;
  body: string;
  /** Where the card sits next to the element on desktop (phones pin it to the bottom of the screen). */
  placement: TourPlacement;
  /** The element is in the sidebar: phones open the drawer for it and also ring the menu button. */
  drawer?: boolean;
};

export const TOUR_STEPS: TourStep[] = [
  { id: "nav-home", route: "/", title: "Your solar system at a glance", body: "See how your system is performing and how much you’re saving, all in one place.", placement: "right", drawer: true },
  { id: "savings", route: "/", title: "Watch your savings grow", body: "This is how much you’ve saved since your system was installed. It goes up every day, so check back often.", placement: "right" },
  { id: "performance", route: "/", title: "See where your power comes from", body: "Track how much your panels generated, how much you drew from the grid, and how much came from your battery. Switch views between day, month, or year.", placement: "right" },
  { id: "battery", route: "/", title: "Know your battery’s charge", body: "See whether your battery is charging or in use, and how much backup power is left.", placement: "left" },
  { id: "nav-support", route: "/", title: "Need help? Start here", body: "Go to Support to submit a ticket or book a preventive maintenance service (PMS) visit.", placement: "right", drawer: true },
  { id: "ticket", route: "/support", title: "Got a concern?", body: "Create a ticket here and our team will get back to you as soon as possible.", placement: "bottom" },
  { id: "pms", route: "/support", title: "Book your PMS", body: "Request a schedule for your Preventive Maintenance Service (PMS) so your system keeps running at its best.", placement: "bottom" },
  { id: "contact", route: "/support", title: "Prefer to talk to someone?", body: "Find Solviva’s phone number and email here so you can reach the team directly.", placement: "bottom" },
  { id: "profile", route: "/support", title: "Your account, your system", body: "View your account info and system details here.", placement: "right", drawer: true },
];

export type TourStage = { kind: "idle" } | { kind: "welcome" } | { kind: "tip"; index: number } | { kind: "no-problem" } | { kind: "all-set" };

export type TourState = {
  stage: TourStage;
  steps: TourStep[];
  /** First name for the welcome and "No problem" copy. */
  firstName: string;
  /** True while a tip rings a sidebar item, so the phone layout keeps the drawer open. */
  wantsDrawer: boolean;
  /** Get Started Tips: go to the Home page and show tip 1. */
  start: () => void;
  next: () => void;
  back: () => void;
  /** × on a tip or "Maybe later" on the welcome: show "No problem". */
  dismiss: () => void;
  /** Finish on the last tip: show "You're all set". */
  finish: () => void;
  /** "Got it" on the two highlights. */
  acknowledge: () => void;
};

/** Exported for the dev preview, which drives the overlay with its own state (no login). */
export const TourContext = createContext<TourState | null>(null);

/* ------------------------------------------------------------ persistence */

const META_KEY = "portal_tour";
type TourRecord = { status: "completed" | "dismissed"; at: string };
const storageKey = (userId: string) => `portal.tour.${userId}`;

function readRecord(user: User): TourRecord | null {
  const meta = user.user_metadata?.[META_KEY];
  if (meta && typeof meta === "object" && typeof meta.status === "string") return meta as TourRecord;
  try {
    const raw = localStorage.getItem(storageKey(user.id));
    return raw ? (JSON.parse(raw) as TourRecord) : null;
  } catch {
    return null;
  }
}

async function writeRecord(user: User, status: TourRecord["status"]) {
  const record: TourRecord = { status, at: new Date().toISOString() };
  try {
    localStorage.setItem(storageKey(user.id), JSON.stringify(record));
  } catch {
    /* private mode: the account copy below still works */
  }
  const { error } = await supabase.auth.updateUser({ data: { [META_KEY]: record } });
  if (error) console.warn("tour status not saved to the account:", error.message);
}

/* --------------------------------------------------------------- provider */

export function TourProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { profile, system, loading, error } = usePortal();
  const location = useLocation();
  const navigate = useNavigate();
  const [stage, setStage] = useState<TourStage>({ kind: "idle" });
  const welcomed = useRef(false);

  // First login: once the Home page has its data, offer the tour (only accounts with a system — the
  // welcome says "your solar is live"). Any answer is recorded, so this shows once per account.
  useEffect(() => {
    if (welcomed.current || !user || loading || error || !system || location.pathname !== "/") return;
    if (readRecord(user)) return;
    const t = setTimeout(() => {
      welcomed.current = true;
      setStage((s) => (s.kind === "idle" ? { kind: "welcome" } : s));
    }, 600);
    return () => clearTimeout(t);
  }, [user, loading, error, system, location.pathname]);

  const goTo = useCallback(
    (index: number) => {
      const step = TOUR_STEPS[index];
      if (location.pathname !== step.route) navigate(step.route);
      setStage({ kind: "tip", index });
    },
    [location.pathname, navigate],
  );

  const finish = useCallback(() => {
    if (user) void writeRecord(user, "completed");
    setStage({ kind: "all-set" });
  }, [user]);

  const dismiss = useCallback(() => {
    if (user) void writeRecord(user, "dismissed");
    setStage({ kind: "no-problem" });
  }, [user]);

  const next = useCallback(() => {
    if (stage.kind !== "tip") return;
    if (stage.index + 1 < TOUR_STEPS.length) goTo(stage.index + 1);
    else finish();
  }, [stage, goTo, finish]);

  const back = useCallback(() => {
    if (stage.kind === "tip" && stage.index > 0) goTo(stage.index - 1);
  }, [stage, goTo]);

  const acknowledge = useCallback(() => setStage({ kind: "idle" }), []);
  const start = useCallback(() => goTo(0), [goTo]);

  // Keyboard: Escape closes (× / Maybe later / Got it), arrows step through the tips.
  useEffect(() => {
    if (stage.kind === "idle") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (stage.kind === "tip" || stage.kind === "welcome") dismiss();
        else acknowledge();
      } else if (stage.kind === "tip" && e.key === "ArrowRight") next();
      else if (stage.kind === "tip" && e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, dismiss, acknowledge, next, back]);

  const value = useMemo<TourState>(
    () => ({
      stage,
      steps: TOUR_STEPS,
      firstName: firstName(profile?.full_name || profile?.odoo_customer_name),
      wantsDrawer: stage.kind === "tip" && !!TOUR_STEPS[stage.index].drawer,
      start,
      next,
      back,
      dismiss,
      finish,
      acknowledge,
    }),
    [stage, profile, start, next, back, dismiss, finish, acknowledge],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): TourState {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used inside TourProvider");
  return ctx;
}
