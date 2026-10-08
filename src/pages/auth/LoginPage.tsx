import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { Button, ErrorNotice, Field, Input } from "@/components/ui";
import { AuthLayout } from "./AuthLayout";

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== "/login" ? from : "/", { replace: true });
    } catch (err) {
      setError(err instanceof Error && /invalid login/i.test(err.message) ? "Incorrect email or password." : (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to track your solar savings and manage your system.">
      <form onSubmit={submit} className="flex flex-col gap-5">
        {error && <ErrorNotice message={error} />}
        <Field label="Email address" required>
          <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
        </Field>
        <Field label="Password" required>
          <div className="relative">
            <Input type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="pr-11" />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600" aria-label={show ? "Hide password" : "Show password"}>
              {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </Field>
        <div className="flex items-center justify-end">
          <Link to="/forgot-password" className="text-sm font-semibold text-brand-blue hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" size="lg" full loading={busy}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
