import { useId, useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Circle, CircleCheck, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { LogoutConfirm } from "@/auth/LogoutConfirm";
import { mustChangePassword } from "@/lib/firstLogin";
import { Button, cx, ErrorNotice, Input, Spinner } from "@/components/ui";
import { AuthLayout } from "./AuthLayout";

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  invalid,
  error,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  invalid?: boolean;
  error?: string | null;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-neutral-700">
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          autoComplete="new-password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          invalid={invalid}
          aria-invalid={invalid}
          autoFocus={autoFocus}
          required
          className="pr-11"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
      {error && <p className="mt-1.5 text-sm text-red-700">{error}</p>}
    </div>
  );
}

/**
 * Figma "Create a new password" (node 850:12468). The only page a login still on its temporary
 * password can open (lib/firstLogin.ts; App.tsx sends every portal route here). Saving a new
 * password clears the flag and lets the customer in; the one other way out is logging out.
 */
export default function ChangePasswordPage() {
  const { user, loading, recovering, replaceTemporaryPassword, isTemporaryPassword } = useAuth();
  const location = useLocation();
  const [logoutOpen, setLogoutOpen] = useState(false);

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (recovering) return <Navigate to="/reset-password" replace />;
  if (!mustChangePassword(user)) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== "/change-password" ? from : "/"} replace />;
  }

  return (
    <>
      <ChangePasswordView
      email={user.email ?? ""}
      isTemporaryPassword={isTemporaryPassword}
      onSave={replaceTemporaryPassword} // the cleared flag re-renders this page into the redirect above
      onLogOut={() => setLogoutOpen(true)}
      />
      <LogoutConfirm open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </>
  );
}

/** The screen without the session, so /dev/preview?screen=change-password can render it. */
export function ChangePasswordView({
  email,
  isTemporaryPassword,
  onSave,
  onLogOut,
}: {
  email: string;
  isTemporaryPassword: (password: string) => boolean | null;
  onSave: (password: string) => Promise<void>;
  onLogOut: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // After a reload the temporary password is no longer known here; Supabase still refuses a repeat of it.
  const rules = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "Includes a letter and a number", met: /[A-Za-z]/.test(password) && /\d/.test(password) },
    { label: "Different from your temporary password", met: password.length > 0 && isTemporaryPassword(password) !== true },
  ];
  const mismatch = tried && confirm !== password ? "The passwords do not match." : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    setError(null);
    if (rules.some((r) => !r.met) || confirm !== password) return;
    setBusy(true);
    try {
      await onSave(password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Create a new password" subtitle="You signed in with a temporary password. Choose a new one to continue.">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg bg-neutral-100 px-3.5 py-3 text-sm">
          <p className="min-w-0 text-neutral-500">
            Signed in as <strong className="font-semibold break-all text-neutral-900">{email}</strong>
          </p>
          <button
            type="button"
            onClick={onLogOut}
            className="font-semibold whitespace-nowrap text-brand-blue hover:underline"
          >
            Not you? Log out
          </button>
        </div>

        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          {error && <ErrorNotice message={error} />}
          <div className="flex flex-col gap-2.5">
            <PasswordField label="New password" value={password} onChange={setPassword} placeholder="Enter a new password" invalid={tried && rules.some((r) => !r.met)} autoFocus />
            <ul className="flex flex-col gap-2" aria-label="Password requirements">
              {rules.map((r) => (
                <li key={r.label} className={cx("flex items-center gap-2 text-sm", r.met ? "text-neutral-700" : tried ? "text-red-700" : "text-neutral-700")}>
                  {r.met ? <CircleCheck className="h-4 w-4 shrink-0 text-green-700" aria-hidden="true" /> : <Circle className={cx("h-4 w-4 shrink-0", tried ? "text-red-700" : "text-neutral-400")} aria-hidden="true" />}
                  {r.label}
                  <span className="sr-only">{r.met ? "(met)" : "(not met)"}</span>
                </li>
              ))}
            </ul>
          </div>
          <PasswordField label="Confirm new password" value={confirm} onChange={setConfirm} placeholder="Re-enter your new password" invalid={!!mismatch} error={mismatch} />
          <Button type="submit" size="lg" full loading={busy}>
            Save and continue
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
