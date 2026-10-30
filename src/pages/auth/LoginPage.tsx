import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { Button, ErrorNotice, Field, Input } from "@/components/ui";
import { AuthLayout } from "./AuthLayout";

/** Figma "Log in": heading and button both read "Log in"; "Forgot password?" sits on the password label row. */
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
    <AuthLayout title="Log in" subtitle="Welcome back! Please enter your details.">
      <form onSubmit={submit} className="flex flex-col gap-5">
        {error && <ErrorNotice message={error} />}
        <Field label="Email address">
          <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" required />
        </Field>
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-4">
            <label htmlFor="login-password" className="text-sm font-medium text-neutral-700">
              Password
            </label>
            <Link to="/forgot-password" className="text-sm font-semibold text-brand-blue hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="login-password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
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
        </div>
        <Button type="submit" size="lg" full loading={busy} className="mt-1">
          Log in
        </Button>
      </form>
    </AuthLayout>
  );
}
