"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "./Logo";

type Mode = "login" | "signup";

export function AuthForm({ mode }: { mode: Mode }) {
  const { state, signIn, signUp } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  useEffect(() => {
    if (state.status === "signed-in") router.replace("/dashboard");
  }, [state.status, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        const message = await signIn(email.trim(), password);
        if (message) setError(message);
      } else {
        const result = await signUp(email.trim(), password);
        if (result.error) setError(result.error);
        else if (result.needsConfirmation) setConfirmSent(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const isLogin = mode === "login";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-6">
      <Logo />
      <main className="grid flex-1 content-center gap-6 pb-16">
        {state.status === "error" ? (
          <div role="alert" className="rounded-2xl border-2 border-bad bg-bad-soft p-4 text-ink">
            {state.message}
          </div>
        ) : null}

        {confirmSent ? (
          <div className="grid gap-3" role="status">
            <h1 className="text-2xl font-bold">Check your email</h1>
            <p className="text-muted">
              We sent a confirmation link to <strong className="text-ink">{email}</strong>. Open it, then sign in.
            </p>
            <Link href="/login" className="btn btn-primary w-fit">
              Go to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-bold tracking-tight">
              {isLogin ? "Welcome back" : "Create your account"}
            </h1>
            <form onSubmit={onSubmit} className="grid gap-4" noValidate={false}>
              <label className="grid gap-1.5">
                <span className="font-medium">Email</span>
                <input
                  className="field"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="font-medium">Password</span>
                <div className="relative">
                  <input
                    className="field w-full pr-10"
                    type={showPassword ? "text" : "password"}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted hover:text-ink"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
                {!isLogin ? <span className="text-sm text-muted">At least 6 characters.</span> : null}
              </label>

              {error ? (
                <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 text-bad">
                  {error}
                </p>
              ) : null}

              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? (isLogin ? "Signing in…" : "Creating account…") : isLogin ? "Sign in" : "Create account"}
              </button>
            </form>
            <p className="text-muted">
              {isLogin ? "New to WordTap? " : "Already have an account? "}
              <Link
                href={isLogin ? "/signup" : "/login"}
                className="font-semibold text-ink underline decoration-subtitle decoration-4 underline-offset-4"
              >
                {isLogin ? "Create an account" : "Sign in"}
              </Link>
            </p>
          </>
        )}
      </main>
    </div>
  );
}
