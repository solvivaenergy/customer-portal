import type { User } from "@supabase/supabase-js";

/**
 * First-login password change (Alden, 2026-11-09; mandatory since 2026-11-12). Every customer login
 * is created by the monitoring onboarding on a shared default password with
 * `must_change_password: true` in the Supabase Auth user metadata. While that holds, the only page
 * the portal shows is "Create a new password" (pages/auth/ChangePasswordPage.tsx, routed in
 * App.tsx); nothing else opens until a new password is saved. Every customer login was flagged on
 * 2026-11-09.
 *
 * Between 2026-11-09 and 2026-11-12 the prompt had a "Not now" button that cleared the flag and
 * recorded `first_login_password.status = "skipped"`. Those accounts are still on the temporary
 * password, so they count as not yet changed.
 */
export const MUST_CHANGE_PASSWORD_KEY = "must_change_password";

export const mustChangePassword = (user: User | null | undefined): boolean => {
  const meta = user?.user_metadata;
  return meta?.[MUST_CHANGE_PASSWORD_KEY] === true || meta?.first_login_password?.status === "skipped";
};

/** Metadata written together with any new password, so the account is never asked again. */
export const passwordChangedMetadata = () => ({
  [MUST_CHANGE_PASSWORD_KEY]: false,
  first_login_password: { status: "changed", at: new Date().toISOString() },
});
