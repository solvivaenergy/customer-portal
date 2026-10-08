import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { Button, ErrorNotice, Field, Input } from "@/components/ui";
import { AuthLayout } from "./AuthLayout";

export const PASSWORD_RULES = "At least 8 characters, with a letter and a number.";
export const passwordOk = (p: string) => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);

/** Landing page of the Supabase recovery link; also usable when signed in. */
export default function ResetPasswordPage() {
  const { user, loading, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!passwordOk(password)) return setError(PASSWORD_RULES);
    if (password !== confirm) return setError("Passwords do not match.");
    setError(null);
    setBusy(true);
    try {
      await updatePassword(password);
      navigate("/", { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!loading && !user) {
    return (
      <AuthLayout title="Link expired" subtitle="This password link is no longer valid. Request a new one to continue.">
        <Link to="/forgot-password" className="text-sm font-semibold text-brand-blue hover:underline">
          Request a new link
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set a new password" subtitle={PASSWORD_RULES}>
      <form onSubmit={submit} className="flex flex-col gap-5">
        {error && <ErrorNotice message={error} />}
        <Field label="New password" required>
          <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <Field label="Confirm new password" required>
          <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </Field>
        <Button type="submit" size="lg" full loading={busy || loading}>
          Save password
        </Button>
      </form>
    </AuthLayout>
  );
}
