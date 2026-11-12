import { useState, type ReactNode } from "react";
import { NavLink, Link } from "react-router-dom";
import { Home, LifeBuoy, Lightbulb, LogOut, MapPin, Menu, X } from "lucide-react";
import { LogoutConfirm } from "@/auth/LogoutConfirm";
import { usePortal } from "@/lib/portal";
import { useTour } from "@/lib/tour";
import { temperatureRange, useWeather, weatherIcon } from "@/lib/weather";
import { Button, cx, usePresence } from "@/components/ui";
import { initials } from "@/lib/format";
import { Logo } from "@/components/Logo";
import { TourOverlay } from "@/components/tour/TourOverlay";

/* `tour` marks an element for the onboarding tour (lib/tour.tsx): the overlay finds it by data-tour. */
function NavItem({ to, icon, label, badge, end, tour }: { to: string; icon: ReactNode; label: string; badge?: number; end?: boolean; tour?: string }) {
  return (
    <NavLink
      to={to}
      end={end}
      data-tour={tour}
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

/* `onLogOut` opens the confirmation, which lives in AppShell because the phone drawer unmounts this sidebar when it closes. */
function Sidebar({ onNavigate, onLogOut }: { onNavigate?: () => void; onLogOut: () => void }) {
  const { profile } = usePortal();
  const name = profile?.full_name || profile?.odoo_customer_name || profile?.email || "";
  return (
    <div className="flex h-full flex-col bg-brand-dark px-4 py-6 text-white" onClick={onNavigate}>
      <div className="px-2">
        <Logo size="xl" />
      </div>
      {/* Home and Support together at the top (Figma "Homepage"; Notifications is hidden there and has no source yet). */}
      <nav className="mt-10 flex flex-col gap-1">
        <NavItem to="/" end icon={<Home className="h-5 w-5" />} label="Home" tour="nav-home" />
        <NavItem to="/support" icon={<LifeBuoy className="h-5 w-5" />} label="Support" tour="nav-support" />
      </nav>
      <div className="mt-auto">
        <div className="my-5 border-t border-white/20" />
        <div className="flex items-center gap-3">
          {/* The click bubbles to the wrapper's onNavigate so the phone drawer closes, as it does for the nav items. */}
          <Link to="/account/profile" data-tour="profile" className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-light text-sm font-semibold text-brand-dark">{initials(name)}</span>
            <span className="truncate text-sm font-semibold text-white">{name}</span>
          </Link>
          <button
            onClick={onLogOut}
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

/* Today's forecast for the selected site as Solis Cloud shows it (lib/weather.ts): low–high and the plant's city. */
function WeatherChip() {
  const { system, profile } = usePortal();
  const weather = useWeather(system?.solis_station_id ?? profile?.solis_station_id);
  if (!weather) return null;
  const Icon = weatherIcon(weather.condition_code, weather.is_day);
  return (
    <div className="flex items-center gap-3 text-sm text-neutral-700" title={weather.condition ? `${weather.condition} today in ${weather.city} (Solis Cloud)` : undefined}>
      <span className="flex items-center gap-1.5">
        <Icon className="h-4 w-4 text-neutral-500" /> {temperatureRange(weather)}
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
  const [logoutOpen, setLogoutOpen] = useState(false);
  const tour = useTour();
  // The tour keeps the drawer open while it rings a sidebar item (phones only; from lg the drawer is hidden anyway).
  const drawer = usePresence(open || tour.wantsDrawer, 200);
  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-[296px] shrink-0 lg:block">
        <div className="sticky top-0 h-screen">
          <Sidebar onLogOut={() => setLogoutOpen(true)} />
        </div>
      </aside>

      {/* Mobile header + drawer */}
      <div className="flex items-center justify-between bg-brand-dark px-4 py-3 lg:hidden">
        <Logo size="lg" />
        <button onClick={() => setOpen(true)} data-tour="menu" className="rounded-md p-2 text-white hover:bg-white/10" aria-label="Open menu">
          <Menu className="h-6 w-6" />
        </button>
      </div>
      {drawer.mounted && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className={cx("absolute inset-0 bg-neutral-900/50", drawer.exiting ? "anim-fade-out" : "anim-fade-in")} onClick={() => setOpen(false)} />
          <div className={cx("absolute inset-y-0 left-0 w-[296px] shadow-lg", drawer.exiting ? "anim-slide-out-left" : "anim-slide-in-left")}>
            <Sidebar onNavigate={() => setOpen(false)} onLogOut={() => setLogoutOpen(true)} />
            <button onClick={() => setOpen(false)} className="absolute right-3 top-5 rounded-md p-1 text-white/80 hover:bg-white/10" aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1">
        <div className="max-w-[1120px] px-4 py-6 sm:px-8 sm:py-8">
          {/* Header row (Figma Onboarding v2): Get Started Tips beside the weather and location, on every page. From lg it
              floats to the top-right corner so the first line of the page (the Home greeting, a breadcrumb) starts on the
              same row instead of under it (review 2026-11-12); a long title wraps beside it. Below lg it is a row of its own. */}
          <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3 lg:float-right lg:mb-4 lg:ml-6">
            <Button variant="secondary" onClick={tour.start} data-tour="get-started" className="font-semibold">
              <Lightbulb className="h-4 w-4 text-neutral-500" /> Get Started Tips
            </Button>
            <WeatherChip />
          </div>
          {/* Pages animate their own content below the breadcrumb and header, so those stay still. */}
          {children}
        </div>
      </main>

      <TourOverlay />
      <LogoutConfirm open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </div>
  );
}
