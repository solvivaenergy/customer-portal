import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Overlay, cx, usePresence } from "@/components/ui";
import { TOUR_STEPS, useTour, type TourPlacement, type TourStage } from "@/lib/tour";
import { HighlightNote, TipCard, TOUR_CARD_WIDTH, WelcomeCard } from "./TourCards";

/*
 * Draws the tour over the page: a dim layer with a hole cut around the element of the current step
 * (an SVG mask, so a phone step can also show the menu button), a chartreuse ring on that element,
 * and the card. Elements are located by `data-tour="<id>"` and re-measured on scroll, resize and a
 * short timer, which covers the drawer sliding in, page transitions and charts settling. Desktop
 * cards float beside the element (Figma placements, flipped when they would leave the window);
 * phones pin the tip to the bottom of the screen and scroll the element to the top (designer's
 * notes, 2026-10-29).
 */

type Box = { top: number; left: number; width: number; height: number };

/** Below Tailwind's `lg` the sidebar is a drawer and the cards use their phone layout. */
const PHONE_QUERY = "(max-width: 1023.98px)";
const RING_PAD = 4; // ring and hole sit this far outside the element
const RING_RADIUS = 12;
const GAP = 24; // card to element, desktop
const MARGIN = 16; // card to window edge

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return matches;
}

/** Window size, re-read on resize and on the same timer as the targets (a missed resize event must not strand the card). */
function useWindowSize(active: boolean) {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const update = () => setSize((s) => (s.w === window.innerWidth && s.h === window.innerHeight ? s : { w: window.innerWidth, h: window.innerHeight }));
    update();
    window.addEventListener("resize", update);
    const timer = active ? setInterval(update, 120) : undefined;
    return () => {
      window.removeEventListener("resize", update);
      if (timer) clearInterval(timer);
    };
  }, [active]);
  return size;
}

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** The on-screen element for a tour id — the sidebar renders twice (desktop aside, phone drawer), so pick the visible copy. */
export function visibleTarget(id: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

const boxOf = (el: HTMLElement): Box => {
  const r = el.getBoundingClientRect();
  return { top: r.top - RING_PAD, left: r.left - RING_PAD, width: r.width + 2 * RING_PAD, height: r.height + 2 * RING_PAD };
};
const sameBox = (a: Box | null | undefined, b: Box | null | undefined) =>
  a === b || (!!a && !!b && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5);

/** Boxes of the elements for the given ids (null while one is not on screen yet). */
function useTargets(ids: string[]): (Box | null)[] {
  const key = ids.join("|");
  const [boxes, setBoxes] = useState<(Box | null)[]>([]);
  useEffect(() => {
    const wanted = key ? key.split("|") : [];
    let last: (Box | null)[] = [];
    const measure = () => {
      const next = wanted.map((id) => {
        const el = visibleTarget(id);
        return el ? boxOf(el) : null;
      });
      if (next.length !== last.length || next.some((b, i) => !sameBox(b, last[i]))) {
        last = next;
        setBoxes(next);
      }
    };
    measure();
    if (!wanted.length) return;
    const timer = setInterval(measure, 120);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      clearInterval(timer);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [key]);
  return boxes;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** Desktop position of a tip card next to its element; flips to the other side or below when it would not fit. */
function placeTip(box: Box, placement: TourPlacement, card: { w: number; h: number }, win: { w: number; h: number }): CSSProperties {
  const fits = (p: TourPlacement) => (p === "right" ? box.left + box.width + GAP + card.w <= win.w - MARGIN : p === "left" ? box.left - GAP - card.w >= MARGIN : true);
  let p = placement;
  if (!fits(p)) {
    const other: TourPlacement = p === "right" ? "left" : "right";
    p = p !== "bottom" && fits(other) ? other : "bottom";
  }
  let top: number;
  let left: number;
  if (p === "right") {
    left = box.left + box.width + GAP;
    top = box.top;
  } else if (p === "left") {
    left = box.left - GAP - card.w;
    top = box.top + box.height / 2 - card.h / 2;
  } else {
    left = box.left;
    top = box.top + box.height + GAP;
    if (top + card.h > win.h - MARGIN && box.top - GAP - card.h >= MARGIN) top = box.top - GAP - card.h;
  }
  return { top: clamp(top, MARGIN, win.h - MARGIN - card.h), left: clamp(left, MARGIN, win.w - MARGIN - card.w) };
}

export function TourOverlay() {
  const tour = useTour();
  const phone = useMediaQuery(PHONE_QUERY);

  // Keep the last real stage while the overlay fades out after the tour closes.
  const lastStage = useRef<TourStage>(tour.stage);
  if (tour.stage.kind !== "idle") lastStage.current = tour.stage;
  const stage = lastStage.current;
  const presence = usePresence(tour.stage.kind !== "idle", 160);
  const active = presence.mounted && !presence.exiting;
  const win = useWindowSize(active);

  const step = stage.kind === "tip" ? TOUR_STEPS[stage.index] : null;
  const targetIds = !active ? [] : step ? [step.id, ...(phone && step.drawer ? ["menu"] : [])] : stage.kind === "no-problem" || stage.kind === "all-set" ? ["get-started"] : [];
  const boxes = useTargets(targetIds);
  const targetId = targetIds[0] ?? null;
  const box = boxes[0] ?? null;
  const stageKey = stage.kind === "tip" ? `tip-${stage.index}` : stage.kind;
  // Phones pin the tip card to the bottom, or to the top when the ringed element is in the lower
  // half (the profile link sits at the foot of the drawer).
  const cardAtTop = phone && !!box && box.top + box.height / 2 > win.h / 2;

  // Card size, for placing it (desktop) and for keeping it on screen.
  const cardRef = useRef<HTMLDivElement>(null);
  const [card, setCard] = useState({ w: TOUR_CARD_WIDTH, h: 220 });
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const read = () => setCard({ w: el.offsetWidth, h: el.offsetHeight });
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stageKey, phone]);

  // Focus the card's main button when the card changes (Enter advances; screen readers announce the
  // dialog) — without letting the browser scroll to it, the tour positions the page itself.
  useEffect(() => {
    if (!active) return;
    const el = cardRef.current;
    (el?.querySelector<HTMLElement>("[data-tour-primary]") ?? el)?.focus({ preventScroll: true });
  }, [stageKey, active]);

  // Bring the ringed element into view once per stage: phones scroll it to the top of the screen
  // (the card sits at the bottom), desktop only when it is off screen. Sidebar items are fixed, but
  // a phone goes back to the top so the menu button the drawer came from is in view as well; the
  // Get Started Tips button in the header does the same.
  const scrolledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!targetId || !box || scrolledFor.current === stageKey) return;
    scrolledFor.current = stageKey;
    const behavior: ScrollBehavior = reducedMotion() ? "auto" : "smooth";
    if (step?.drawer) {
      if (phone) window.scrollTo({ top: 0, behavior });
      return;
    }
    const el = visibleTarget(targetId);
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (targetId === "get-started") {
      if (r.top < MARGIN) window.scrollTo({ top: 0, behavior });
    } else if (phone) window.scrollTo({ top: window.scrollY + r.top - MARGIN, behavior });
    else if (r.top < MARGIN || r.bottom > window.innerHeight - MARGIN) el.scrollIntoView({ block: "center", behavior });
  }, [targetId, step, box, phone, stageKey]);
  useEffect(() => {
    if (!active) scrolledFor.current = null;
  }, [active]);

  if (!presence.mounted) return null;

  const holes = boxes.filter((b): b is Box => !!b);
  const cardAnim = presence.exiting ? "anim-pop-out" : "anim-pop-in";

  let content: React.ReactNode = null;
  if (stage.kind === "welcome") {
    content = phone ? (
      <WelcomeCard key="welcome" name={tour.firstName} phone onStart={tour.start} onLater={tour.dismiss} className={cx("absolute inset-x-0 bottom-0", presence.exiting ? "anim-slide-down" : "anim-slide-up")} />
    ) : (
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <WelcomeCard key="welcome" name={tour.firstName} onStart={tour.start} onLater={tour.dismiss} className={cardAnim} />
      </div>
    );
  } else if (step && stage.kind === "tip") {
    const style: CSSProperties = phone ? {} : box ? placeTip(box, step.placement, card, win) : { top: clamp(win.h / 2 - card.h / 2, MARGIN, win.h), left: clamp(win.w / 2 - card.w / 2, MARGIN, win.w) };
    content = (
      <div ref={cardRef} tabIndex={-1} key={stageKey} className={cx("absolute outline-none", cardAnim, phone && "inset-x-2", phone && (cardAtTop ? "top-[max(0.5rem,env(safe-area-inset-top))]" : "bottom-[max(0.5rem,env(safe-area-inset-bottom))]"))} style={style}>
        <TipCard index={stage.index} total={TOUR_STEPS.length} title={step.title} body={step.body} phone={phone} onNext={tour.next} onBack={tour.back} onClose={tour.dismiss} />
      </div>
    );
  } else if (stage.kind === "no-problem" || stage.kind === "all-set") {
    // Under the Get Started Tips button: right edges aligned on desktop, full width on phones.
    const style: CSSProperties = box
      ? phone
        ? { top: clamp(box.top + box.height + 12, MARGIN, win.h - MARGIN - card.h) }
        : { top: clamp(box.top + box.height + 12, MARGIN, win.h - MARGIN - card.h), left: clamp(box.left + box.width + 12 - card.w, MARGIN, win.w - MARGIN - card.w) }
      : phone
        ? { top: MARGIN }
        : { top: MARGIN, left: clamp(win.w / 2 - card.w / 2, MARGIN, win.w) };
    content = (
      <div ref={cardRef} tabIndex={-1} key={stageKey} className={cx("absolute outline-none", cardAnim, phone && "inset-x-4")} style={style}>
        <HighlightNote kind={stage.kind} name={tour.firstName} phone={phone} onDone={tour.acknowledge} />
      </div>
    );
  }

  return (
    <Overlay>
      <div className={cx("fixed inset-0 z-50", presence.exiting ? "anim-fade-out" : "anim-fade-in")}>
        {/* Dim everything except the ringed elements. The rect catches clicks so the page stays put during the tour. */}
        <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <mask id="tour-dim-mask">
              <rect width="100%" height="100%" fill="white" />
              {holes.map((b, i) => (
                <rect key={i} x={b.left} y={b.top} width={b.width} height={b.height} rx={RING_RADIUS} fill="black" />
              ))}
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgb(16 24 40 / 0.55)" mask="url(#tour-dim-mask)" />
        </svg>
        {holes.map((b, i) => (
          <div key={i} className="pointer-events-none absolute rounded-[12px] border-2 border-brand-chartreuse" style={{ top: b.top, left: b.left, width: b.width, height: b.height, boxShadow: "0 0 0 3px rgb(210 255 30 / 0.3)" }} />
        ))}
        {content}
      </div>
    </Overlay>
  );
}
