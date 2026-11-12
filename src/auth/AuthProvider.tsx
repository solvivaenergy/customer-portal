import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { appUrl } from "@/lib/env";
import { mustChangePassword, passwordChangedMetadata } from "@/lib/firstLogin";

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** True while the user arrived through a password-recovery link and must set a new password. */
  recovering: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  /** Re-authenticates with the current password before changing it (Supabase does not check it). */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /** First login (lib/firstLogin.ts): replaces the temporary password and lifts the block on the portal. */
  replaceTemporaryPassword: (newPassword: string) => Promise<void>;
  /** Whether `password` is the temporary one typed at sign-in; null when unknown (the page was reloaded since). */
  isTemporaryPassword: (password: string) => boolean | null;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);
  // The temporary password as typed at sign-in, kept in memory only while it must be replaced, so the
  // "Create a new password" page can tell the customer the new one has to differ. Never stored.
  const temporaryPassword = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      if (event === "SIGNED_OUT") {
        setRecovering(false);
        temporaryPassword.current = null;
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      recovering,
      signIn: async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        temporaryPassword.current = mustChangePassword(data.user) ? password : null;
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
      requestPasswordReset: async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: appUrl("/reset-password"),
        });
        if (error) throw error;
      },
      updatePassword: async (newPassword) => {
        const { error } = await supabase.auth.updateUser({ password: newPassword, data: passwordChangedMetadata() });
        if (error) throw error;
        temporaryPassword.current = null;
        setRecovering(false);
      },
      changePassword: async (currentPassword, newPassword) => {
        const email = session?.user.email;
        if (!email) throw new Error("Not signed in");
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
        if (authError) throw new Error("Current password is incorrect");
        const { error } = await supabase.auth.updateUser({ password: newPassword, data: passwordChangedMetadata() });
        if (error) throw error;
      },
      replaceTemporaryPassword: async (newPassword) => {
        // One call: the new password and the cleared flag together.
        const { error } = await supabase.auth.updateUser({ password: newPassword, data: passwordChangedMetadata() });
        if (error) throw error.code === "same_password" ? new Error("Your new password must be different from your temporary password.") : error;
        temporaryPassword.current = null;
      },
      isTemporaryPassword: (password) => (temporaryPassword.current === null ? null : password === temporaryPassword.current),
    }),
    [session, loading, recovering],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
