import { Link } from "react-router-dom";
import { SolvivaLogoHorizontal } from "./brand";
import { cx } from "./ui";

/**
 * Solviva horizontal lockup from the Figma mockup (sunburst + SOLVIVA + "An AboitizPower Company").
 * `light` = white on the dark-green sidebar; `dark` = brand green on light backgrounds (login card).
 * The artwork is 110×32, so the width follows the height.
 */
const SIZES = { md: "h-8 w-[110px]", lg: "h-10 w-[137.5px]", xl: "h-12 w-[165px]" };

export function Logo({ variant = "light", size = "md", linkTo = "/" }: { variant?: "light" | "dark"; size?: keyof typeof SIZES; linkTo?: string | null }) {
  const logo = <SolvivaLogoHorizontal className={cx(SIZES[size], variant === "light" ? "text-white" : "text-brand-dark")} />;
  return linkTo ? (
    <Link to={linkTo} aria-label="Solviva home" className="inline-flex">
      {logo}
    </Link>
  ) : (
    logo
  );
}
