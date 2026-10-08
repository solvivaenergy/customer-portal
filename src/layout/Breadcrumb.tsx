import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export type Crumb = { label: string; to?: string };

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav className="mb-6 flex flex-wrap items-center gap-2 text-base text-neutral-500" aria-label="Breadcrumb">
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && <ChevronRight className="h-4 w-4 text-neutral-400" />}
            {last || !c.to ? <span className={last ? "font-medium text-brand-blue" : ""}>{c.label}</span> : <Link to={c.to} className="hover:text-neutral-700">{c.label}</Link>}
          </span>
        );
      })}
    </nav>
  );
}
