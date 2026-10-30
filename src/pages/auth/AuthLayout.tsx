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
 * line and a large low-opacity sun mark of which only the top-left quarter shows in the bottom-right
 * corner. The earlier dashboard preview was dropped because its sample figures read as the
 * customer's own and exposed portal details before login. Phone: a chartreuse banner with the
 * lockup and a cropped sun mark in its top-right corner, then the form on white with the same legal
 * links at the bottom. No "remember me" (design review 2026-10-26).
 */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Phone / tablet banner: the lockup sits a touch below centre; the sun mark hangs from the top-right corner and takes about a third of the width, as in the Figma frame. */}
      <header className="relative overflow-hidden bg-brand-chartreuse px-6 pt-9 pb-6 lg:hidden">
        <Logo variant="dark" size="lg" linkTo={null} />
        <SolvivaSunMark className="pointer-events-none absolute right-0 top-0 h-64 w-64 translate-x-[35%] -translate-y-[35%] text-brand-dark/10" />
      </header>

      {/*
        Desktop: both panels share one grid so the page heading and "Your solar," start on the same
        row and share a baseline (review note 2026-10-30). Columns 3fr/2fr; rows: spacer, lockup,
        heading + content, spacer, footer. The welcome panel's background spans every row of the
        right column; its text sits in the heading row. Below lg the same children stack as a column.
      */}
      <div className="flex flex-1 flex-col lg:grid lg:min-h-screen lg:grid-cols-[3fr_2fr] lg:grid-rows-[1fr_auto_auto_1fr_auto]">
        <div className="relative hidden overflow-hidden bg-brand-chartreuse lg:col-start-2 lg:row-span-full lg:block" aria-hidden="true">
          {/* Sized by viewport height so the visible quarter (~36vh) always stays below the welcome text, whatever the window size. */}
          <SolvivaSunMark className="pointer-events-none absolute bottom-0 right-0 h-[75vh] w-[75vh] translate-x-[45%] translate-y-[55%] text-brand-dark/10" />
        </div>

        <div className="hidden lg:col-start-1 lg:row-start-2 lg:block lg:w-full lg:max-w-md lg:justify-self-center lg:pb-10">
          <Logo variant="dark" size="xl" linkTo={null} />
        </div>

        <main className="anim-fade-up flex-1 px-6 pt-6 pb-8 sm:px-10 lg:col-start-1 lg:row-start-3 lg:w-full lg:max-w-md lg:flex-none lg:justify-self-center lg:self-baseline lg:px-0 lg:py-0">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">{title}</h1>
          {subtitle && <p className="mt-2 text-base text-neutral-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </main>

        <aside className="relative hidden lg:col-start-2 lg:row-start-3 lg:block lg:self-baseline lg:px-14 xl:px-20" aria-label="Welcome">
          <h2 className="text-4xl font-semibold leading-[1.1] tracking-tight text-brand-dark xl:text-5xl">
            Your solar,
            <br />
            all in one place.
          </h2>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-neutral-900">
            See what your panels save you, check how your system is doing, and reach out to our solar experts when you need a hand.
          </p>
        </aside>

        <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 pb-6 text-xs text-neutral-500 sm:px-10 lg:col-start-1 lg:row-start-5 lg:w-full lg:max-w-md lg:justify-self-center lg:px-0 lg:pb-12">
          <span>© {new Date().getFullYear()} Solviva Energy, Inc.</span>
          <a href={TERMS.url} target="_blank" rel="noreferrer" className="hover:text-neutral-700 hover:underline">
            Terms of use
          </a>
          <a href={PRIVACY.url} target="_blank" rel="noreferrer" className="hover:text-neutral-700 hover:underline">
            Privacy policy
          </a>
        </footer>
      </div>
    </div>
  );
}
