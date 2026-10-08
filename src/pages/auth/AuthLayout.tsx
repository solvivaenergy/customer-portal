import type { ReactNode } from "react";
import { asset } from "@/lib/env";

/** Centered card on a dark-green backdrop; used by login / forgot / reset pages (not in the mockup — improvised). */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-brand-dark">
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
          <div className="mb-8 flex items-center gap-3">
            <img src={asset("brand/solviva-mark-green.png")} alt="" className="h-10 w-10 rounded-full bg-brand-chartreuse p-1" />
            <span className="leading-tight">
              <span className="block text-xl font-bold tracking-wide text-brand-dark">SOLVIVA</span>
              <span className="block text-[11px] text-neutral-500">Customer Portal</span>
            </span>
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
