import { useState, type ReactNode } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { Bell, Home, LifeBuoy, LogOut, MapPin, Menu, Sun, X } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { usePortal } from "@/lib/portal";
import { useWeather } from "@/lib/weather";
import { cx } from "@/components/ui";
import { initials } from "@/lib/format";
import { asset } from "@/lib/env";

const NOTIFICATION_COUNT = 0; // No notification source yet (see docs/integrations.md).

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="Solviva home">
      <img src={asset("brand/solviva-mark-green.png")} alt="" className="h-9 w-9 rounded-full bg-brand-chartreuse p-1" />
      <span className="leading-tight">
        <span className="block text-lg font-bold tracking-wide text-white">SOLVIVA</span>
        <span className="block text-[10px] text-white/70">An AboitizPower Company</span>
      </span>
    </Link>
  );
}

function NavItem({ to, icon, label, badge, end }: { to: string; icon: ReactNode; label: string; badge?: number; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cx(
          "flex items-center gap-3 rounded-lg px-4 py-3 text-base font-semibold text-white/90 transition-colors hover:bg-white/10",
          isActive && "bg-white/15 text-white",
        )
      }
    >
      <span className="text-white/90">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge ? <span className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-semibold text-brand-dark">{badge}</span> : null}
    </NavLink>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { signOut } = useAuth();
  const { profile } = usePortal();
  const navigate = useNavigate();
  const name = profile?.full_name || profile?.odoo_customer_name || profile?.email || "";
  return (
    <div className="flex h-full flex-col bg-brand-dark px-4 py-6 text-white" onClick={onNavigate}>
      <div className="px-2">
        <Logo />
      </div>
      <nav className="mt-10 flex flex-col gap-1">
        <NavItem to="/" end icon={<Home className="h-5 w-5" />} label="Home" />
        <NavItem to="/notifications" icon={<Bell className="h-5 w-5" />} label="Notifications" badge={NOTIFICATION_COUNT} />
      </nav>
      <div className="mt-auto">
        <nav className="flex flex-col gap-1">
          <NavItem to="/support" icon={<LifeBuoy className="h-5 w-5" />} label="Support" />
        </nav>
        <div className="my-5 border-t border-white/20" />
        <div className="flex items-center gap-3 px-2">
          <Link to="/account/profile" className="flex min-w-0 flex-1 items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-light text-sm font-semibold text-brand-dark">{initials(name)}</span>
            <span className="truncate text-sm font-semibold text-white">{name}</span>
          </Link>
          <button
            onClick={async (e) => {
              e.stopPropagation();
              await signOut();
              navigate("/login", { replace: true });
            }}
            className="rounded-md p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function WeatherChip() {
  const { system, profile } = usePortal();
  const weather = useWeather(system?.address || profile?.address);
  if (!weather) return null;
  return (
    <div className="flex items-center gap-3 text-sm text-neutral-700">
      <span className="flex items-center gap-1.5">
        <Sun className="h-4 w-4 text-neutral-500" /> {weather.temperatureC}°C
      </span>
      <span className="h-5 w-px bg-neutral-300" />
      <span className="flex items-center gap-1.5">
        <MapPin className="h-4 w-4 text-neutral-500" /> {weather.city}
      </span>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-[296px] shrink-0 lg:block">
        <div className="sticky top-0 h-screen">
          <Sidebar />
        </div>
      </aside>

      {/* Mobile header + drawer */}
      <div className="flex items-center justify-between bg-brand-dark px-4 py-3 lg:hidden">
        <Logo />
        <button onClick={() => setOpen(true)} className="rounded-md p-2 text-white hover:bg-white/10" aria-label="Open menu">
          <Menu className="h-6 w-6" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-neutral-900/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[296px] shadow-lg">
            <Sidebar onNavigate={() => setOpen(false)} />
            <button onClick={() => setOpen(false)} className="absolute right-3 top-5 rounded-md p-1 text-white/80 hover:bg-white/10" aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1120px] px-4 py-6 sm:px-8 sm:py-8">
          <div className="mb-6 flex items-center justify-end">
            <WeatherChip />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
