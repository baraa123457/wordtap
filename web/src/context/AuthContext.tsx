"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { getAuthRedirectUrl, getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export type AuthState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; user: User }
  | { status: "error"; message: string };

type SignUpResult = { error: string | null; needsConfirmation: boolean };

type AuthContextValue = {
  state: AuthState;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  resendConfirmation: (email: string) => Promise<string | null>;
  resetPassword: (email: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setState({
        status: "error",
        message:
          "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart the dev server.",
      });
      return;
    }

    const supabase = getSupabase();
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setState({ status: "error", message: error.message });
        else setState(data.session ? { status: "signed-in", user: data.session.user } : { status: "signed-out" });
      })
      .catch((e: unknown) => {
        if (active) setState({ status: "error", message: e instanceof Error ? e.message : "Could not reach Supabase." });
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(session ? { status: "signed-in", user: session.user } : { status: "signed-out" });
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<SignUpResult> => {
    const emailRedirectTo = getAuthRedirectUrl("/auth/callback");
    const { data, error } = await getSupabase().auth.signUp({
      email,
      password,
      options: emailRedirectTo ? { emailRedirectTo } : undefined,
    });
    if (error) return { error: error.message, needsConfirmation: false };
    return { error: null, needsConfirmation: data.session === null };
  }, []);

  const resendConfirmation = useCallback(async (email: string) => {
    const emailRedirectTo = getAuthRedirectUrl("/auth/callback");
    const { error } = await getSupabase().auth.resend({
      type: "signup",
      email,
      options: emailRedirectTo ? { emailRedirectTo } : undefined,
    });
    return error ? error.message : null;
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const redirectTo = getAuthRedirectUrl("/auth/callback?next=/settings%23password");
    const { error } = await getSupabase().auth.resetPasswordForEmail(
      email,
      redirectTo ? { redirectTo } : undefined,
    );
    return error ? error.message : null;
  }, []);

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ state, signIn, signUp, resendConfirmation, resetPassword, signOut }),
    [state, signIn, signUp, resendConfirmation, resetPassword, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}
