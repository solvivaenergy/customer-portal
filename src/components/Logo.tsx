import { Link } from "react-router-dom";
import { asset } from "@/lib/env";
import { cx } from "./ui";

/**
 * Solviva lockup as in the mockup: sunburst mark + "SOLVIVA" + "An AboitizPower Company".
 * `light` = white on the dark-green sidebar (the brand mark PNG is dark green, so it is
 * inverted to white with CSS); `dark` = green on light backgrounds (login card).
 */
export function Logo({ variant = "light", size = "md", linkTo = "/" }: { variant?: "light" | "dark"; size?: "md" | "lg"; linkTo?: string | null }) {
  const light = variant === "light";
  const mark = <img src={asset("brand/solviva-mark-green.png")} alt="" className={cx(size === "lg" ? "h-10 w-10" : "h-9 w-9", light && "brightness-0 invert")} />;
  const content = (
    <span className="flex items-center gap-2.5">
      {mark}
      <span className="leading-none">
        <span className={cx("block font-bold tracking-[0.08em]", size === "lg" ? "text-xl" : "text-lg", light ? "text-white" : "text-brand-dark")}>SOLVIVA</span>
        <span className={cx("mt-1 block text-[9px] tracking-wide", light ? "text-white/80" : "text-neutral-500")}>An AboitizPower Company</span>
      </span>
    </span>
  );
  return linkTo ? (
    <Link to={linkTo} aria-label="Solviva home" className="inline-flex">
      {content}
    </Link>
  ) : (
    content
  );
}
