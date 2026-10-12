import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";

/** Centered card on a dark-green backdrop; used by login / forgot / reset pages (not in the mockup — improvised). */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-brand-dark">
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
          <div className="mb-8">
            <Logo variant="dark" size="lg" linkTo={null} />
          </div>
          <h1 className="text-2xl font-semibold text-neutral-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
      <p className="pb-6 text-center text-xs text-white/60">© {new Date().getFullYear()} Solviva Energy, Inc. · An AboitizPower Company</p>
    </div>
  );
}
