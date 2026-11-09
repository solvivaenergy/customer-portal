import { useState, type FormEvent } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import { MUST_CHANGE_PASSWORD_KEY, mustChangePassword } from "@/lib/firstLogin";
import { Button, ErrorNotice, Input, Modal } from "@/components/ui";
import { PASSWORD_RULES, passwordOk } from "@/pages/auth/ResetPasswordPage";

/**
 * Shown once, on the first sign-in of an account still on its temporary password (lib/firstLogin.ts).
 * Setting a password or choosing "Not now" clears the flag, so the prompt never returns; the
 * onboarding tour's welcome waits until this is answered.
 */
export function FirstLoginPasswordPrompt() {
  const { user } = useAuth();
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const open = mustChangePassword(user);

  const record = (status: "changed" | "skipped") => ({ [MUST_CHANGE_PASSWORD_KEY]: false, first_login_password: { status, at: new Date().toISOString() } });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!passwordOk(next)) return setError(PASSWORD_RULES);
    if (next !== confirm) return setError("The passwords do not match.");
    setBusy(true);
    setError(null);
    try {
      // One call: the new password and the cleared flag together.
      const { error: err } = await supabase.auth.updateUser({ password: next, data: record("changed") });
      if (err) throw err;
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ data: record("skipped") });
      if (err) console.warn("first-login prompt not recorded:", err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;
  return (
    <Modal open={open} onClose={skip} title="Set your own password">
      <p className="text-sm text-neutral-600">Your account was set up with a temporary password. Choose your own to keep your account secure. You can also do this later under My account.</p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
        {error && <ErrorNotice message={error} />}
        <label className="block text-sm font-medium text-neutral-700">
          New password
          <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required className="mt-1.5" />
          <span className="mt-1 block text-xs font-normal text-neutral-500">{PASSWORD_RULES}</span>
        </label>
        <label className="block text-sm font-medium text-neutral-700">
          Confirm new password
          <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className="mt-1.5" />
        </label>
        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={skip} disabled={busy}>
            Not now
          </Button>
          <Button type="submit" loading={busy}>
            Set password
          </Button>
        </div>
      </form>
    </Modal>
  );
}
