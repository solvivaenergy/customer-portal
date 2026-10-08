import { forwardRef, useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Loader2, X } from "lucide-react";

export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

/* ---------------------------------------------------------------- Buttons */

type ButtonVariant = "primary" | "secondary" | "ghost" | "dark" | "accent" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-brand-blue text-white hover:bg-[#0059a8] shadow-xs",
  secondary: "bg-white text-neutral-700 border border-neutral-300 hover:bg-neutral-50 shadow-xs",
  ghost: "bg-transparent text-neutral-600 hover:bg-neutral-100",
  dark: "bg-brand-dark text-white hover:bg-[#17401f] shadow-xs",
  accent: "bg-brand-chartreuse text-brand-dark hover:bg-[#c4f20f] shadow-xs",
  danger: "bg-red-700 text-white hover:bg-[#912018] shadow-xs",
};
const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean; full?: boolean }
>(function Button({ variant = "primary", size = "md", loading, full, className, children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 disabled:cursor-not-allowed disabled:opacity-60",
        buttonVariants[variant],
        buttonSizes[size],
        full && "w-full",
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});

/* ------------------------------------------------------------------ Inputs */

const fieldBase =
  "w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-base text-neutral-900 shadow-xs placeholder:text-neutral-400 focus:border-brand-blue focus:outline-none focus:ring-4 focus:ring-brand-blue/10 disabled:bg-neutral-50 disabled:text-neutral-500";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...rest }, ref) {
    return <input ref={ref} className={cx(fieldBase, invalid && "border-red-700 focus:border-red-700 focus:ring-red-700/10", className)} {...rest} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ className, invalid, ...rest }, ref) {
    return <textarea ref={ref} className={cx(fieldBase, "min-h-[120px] resize-y", invalid && "border-red-700", className)} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(
  function Select({ className, invalid, children, ...rest }, ref) {
    return (
      <select ref={ref} className={cx(fieldBase, "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2220%22 height=%2220%22 viewBox=%220 0 20 20%22 fill=%22none%22 stroke=%22%23667085%22 stroke-width=%221.67%22><path d=%22M5 7.5l5 5 5-5%22/></svg>')] bg-[length:20px_20px] bg-[position:right_12px_center] bg-no-repeat pr-10", invalid && "border-red-700", className)} {...rest}>
        {children}
      </select>
    );
  },
);

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 block text-sm font-medium text-neutral-700">
        {label}
        {required && <span className="text-red-700"> *</span>}
      </span>
      {children}
      {error ? <span className="mt-1.5 block text-sm text-red-700">{error}</span> : hint ? <span className="mt-1.5 block text-sm text-neutral-500">{hint}</span> : null}
    </label>
  );
}

/* ------------------------------------------------------------------- Cards */

export function Card({ children, className, padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
  return <div className={cx("rounded-xl border border-neutral-200 bg-white shadow-xs", padded && "p-6", className)}>{children}</div>;
}

/* ------------------------------------------------------------------ Badges */

export type BadgeTone = "neutral" | "green" | "amber" | "blue" | "red" | "brand";
const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-neutral-100 text-neutral-700",
  green: "bg-green-50 text-green-700",
  amber: "bg-amber-50 text-amber-700",
  blue: "bg-blue-50 text-blue-700",
  red: "bg-red-50 text-red-700",
  brand: "bg-brand-light text-brand-dark",
};
export function Badge({ tone = "neutral", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium", badgeTones[tone], className)}>{children}</span>;
}

/* -------------------------------------------------------------------- Tabs */

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div className={cx("flex gap-4 overflow-x-auto border-b border-neutral-200", className)} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            "-mb-px whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-semibold transition-colors",
            value === t.id ? "border-brand-olive text-brand-olive" : "border-transparent text-neutral-500 hover:text-neutral-700",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Segmented pill control (used for Support | PMS and 1D/1W/1M/1Y/YTD). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  className,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div className={cx("inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cx(
            "rounded-md font-semibold transition-colors",
            size === "sm" ? "px-3 py-1 text-sm" : "px-5 py-2 text-sm",
            value === o.id ? "bg-white text-neutral-800 shadow-xs" : "text-neutral-500 hover:text-neutral-700",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------- Modal */

export function Modal({
  open,
  onClose,
  title,
  children,
  width = "max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 p-4" onClick={onClose}>
      <div className={cx("w-full rounded-xl bg-white p-6 shadow-lg", width)} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- States etc. */

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx("h-5 w-5 animate-spin text-neutral-400", className)} />;
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-light text-brand-dark">{icon}</div>}
      <p className="text-base font-semibold text-neutral-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-neutral-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorNotice({ message }: { message: string }) {
  return <div className="rounded-lg border border-red-700/20 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">{title}</h1>
        {subtitle && <p className="mt-1 text-base text-neutral-500">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
