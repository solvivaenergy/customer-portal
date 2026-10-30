import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { SolvivaSunMark } from "@/components/brand";
import { PRIVACY, TERMS } from "@/content/legal";

/**
 * Shell for the login, forgot-password and reset-password pages, from the Figma "Log in" frames
 * (page "Log In (Exploration)", revised 2026-10-23).
 *
 * Desktop (lg+): the form sits on a white panel (~60%) with the lockup above it and the legal links
 * at the foot; a chartreuse welcome panel (~40%) on the right carries a headline, one supporting
 * line and a large low-opacity sun mark bleeding off the bottom-right corner. The earlier dashboard
 * preview was dropped because its sample figures read as the customer's own and exposed portal
 * details before login. Phone: a chartreuse header with the lockup and a cropped sun mark, then the
 * form on white with the same legal links at the bottom. No "remember me" (design review 2026-10-26).
 */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white lg:flex-row">
      {/* Phone / tablet header */}
      <header className="relative overflow-hidden bg-brand-chartreuse px-6 py-5 lg:hidden">
        <Logo variant="dark" size="lg" linkTo={null} />
        <SolvivaSunMark className="pointer-events-none absolute -right-6 -top-10 h-32 w-32 text-brand-dark/10" />
      </header>

      {/* Form panel */}
      <main className="flex flex-1 flex-col items-center px-6 py-8 sm:px-10 lg:w-3/5 lg:flex-none lg:px-16 lg:py-12">
        <div className="flex w-full max-w-md flex-1 flex-col">
          {/* Phone frame: the form starts right under the chartreuse header; desktop: centred beside the welcome panel. */}
          <div className="anim-fade-up flex flex-1 flex-col pt-4 pb-8 lg:justify-center lg:py-12">
            <div className="mb-10 hidden lg:block">
              <Logo variant="dark" size="xl" linkTo={null} />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">{title}</h1>
            {subtitle && <p className="mt-2 text-base text-neutral-500">{subtitle}</p>}
            <div className="mt-8">{children}</div>
          </div>
          <footer className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
            <span>© {new Date().getFullYear()} Solviva Energy, Inc.</span>
            <a href={TERMS.url} target="_blank" rel="noreferrer" className="hover:text-neutral-700 hover:underline">
              Terms of use
            </a>
            <a href={PRIVACY.url} target="_blank" rel="noreferrer" className="hover:text-neutral-700 hover:underline">
              Privacy policy
            </a>
          </footer>
        </div>
      </main>

      {/* Welcome panel (desktop only) */}
      <aside className="relative hidden overflow-hidden bg-brand-chartreuse lg:flex lg:w-2/5 lg:flex-col lg:justify-center lg:px-14 xl:px-20" aria-label="Welcome">
        <div className="relative z-10 -mt-16 max-w-md">
          <h2 className="text-4xl font-semibold leading-[1.1] tracking-tight text-brand-dark xl:text-5xl">
            Your solar,
            <br />
            all in one place.
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-brand-dark/80">
            See what your panels save you, check how your system is doing, and reach out to our solar experts when you need a hand.
          </p>
        </div>
        <SolvivaSunMark className="pointer-events-none absolute -bottom-[16%] -right-[14%] w-[72%] text-brand-dark/10" />
      </aside>
    </div>
  );
}
