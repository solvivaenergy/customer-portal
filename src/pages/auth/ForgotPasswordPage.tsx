import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { Button, ErrorNotice, Field, Input } from "@/components/ui";
import { AuthLayout } from "./AuthLayout";

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Reset your password" subtitle="Enter the email you use for the portal and we'll send a link to set a new password.">
      {sent ? (
        <div className="flex flex-col gap-5">
          <div className="rounded-lg border border-green-700/20 bg-green-50 px-4 py-3 text-sm text-green-700">
            If an account exists for <strong>{email}</strong>, a reset link is on its way. The link is valid for a limited time.
          </div>
          <Link to="/login" className="text-sm font-semibold text-brand-blue hover:underline">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-5">
          {error && <ErrorNotice message={error} />}
          <Field label="Email address" required>
            <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Button type="submit" size="lg" full loading={busy}>
            Send reset link
          </Button>
          <Link to="/login" className="text-center text-sm font-semibold text-brand-blue hover:underline">
            Back to sign in
          </Link>
        </form>
      )}
    </AuthLayout>
  );
}
