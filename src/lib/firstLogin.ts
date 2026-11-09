import type { User } from "@supabase/supabase-js";

/**
 * First-login password prompt (Alden, 2026-11-09). Every customer login is created by the
 * monitoring onboarding on a shared default password with `must_change_password: true` in the
 * Supabase Auth user metadata. The portal shows the prompt once while the flag is set and clears
 * it whether the customer sets a password or chooses "Not now"; the password can always be
 * changed later under My account. Every customer login was flagged on 2026-11-09, so each is
 * prompted on its next sign-in.
 */
export const MUST_CHANGE_PASSWORD_KEY = "must_change_password";

export const mustChangePassword = (user: User | null | undefined): boolean => user?.user_metadata?.[MUST_CHANGE_PASSWORD_KEY] === true;
