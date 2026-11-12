"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "./Logo";

type Mode = "login" | "signup";

export function AuthForm({ mode }: { mode: Mode }) {
  const { state, signIn, signUp, resendConfirmation, resetPassword } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);

  useEffect(() => {
    if (state.status === "signed-in") router.replace("/dashboard");
  }, [state.status, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setStatusMessage(null);
    try {
      if (forgotMode) {
        const message = await resetPassword(email.trim());
        if (message) setError(message);
        else setStatusMessage(`Password reset link sent to ${email.trim()}. Check your inbox.`);
      } else if (mode === "login") {
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

  async function handleResendConfirmation() {
    setBusy(true);
    setError(null);
    setStatusMessage(null);
    try {
      const message = await resendConfirmation(email.trim());
      if (message) setError(message);
      else setStatusMessage("A fresh confirmation email has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend confirmation email.");
    } finally {
      setBusy(false);
    }
  }

  const isLogin = mode === "login";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-6">
      <Logo />
      <main className="grid flex-1 content-center pb-16">
        <div className="apple-card p-6 sm:p-8 shadow-sm grid gap-6">
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
              {statusMessage ? (
                <p className="rounded-xl bg-ok-soft border border-ok/30 px-4 py-2.5 text-xs font-medium text-ok">
                  {statusMessage}
                </p>
              ) : null}
              {error ? (
                <p role="alert" className="rounded-xl bg-bad-soft border border-bad/30 px-4 py-2.5 text-xs font-medium text-bad">
                  {error}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link href="/login" className="btn btn-primary w-fit">
                  Go to sign in
                </Link>
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={busy}
                  className="btn btn-quiet text-xs font-semibold"
                >
                  {busy ? "Sending…" : "Resend link"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
                  {forgotMode ? "Reset password" : isLogin ? "Welcome back" : "Create your account"}
                </h1>
                <p className="text-xs sm:text-sm text-muted mt-1">
                  {forgotMode
                    ? "Enter your account email and we will send you a password reset link."
                    : isLogin
                      ? "Sign in to continue practicing your subtitle vocabulary."
                      : "Start capturing subtitle words from YouTube & Netflix."}
                </p>
              </div>
              <form onSubmit={onSubmit} className="grid gap-4" noValidate={false}>
                <label className="grid gap-1.5">
                  <span className="font-medium text-xs sm:text-sm text-ink">Email</span>
                  <input
                    className="field"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                {!forgotMode ? (
                  <label className="grid gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-xs sm:text-sm text-ink">Password</span>
                      {isLogin ? (
                        <button
                          type="button"
                          onClick={() => {
                            setForgotMode(true);
                            setError(null);
                            setStatusMessage(null);
                          }}
                          className="text-xs font-semibold text-muted hover:text-ink underline underline-offset-4 cursor-pointer"
                        >
                          Forgot password?
                        </button>
                      ) : null}
                    </div>
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
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted hover:text-ink cursor-pointer"
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
                    {!isLogin ? <span className="text-xs text-muted">At least 6 characters.</span> : null}
                  </label>
                ) : null}

                {statusMessage ? (
                  <p role="status" className="rounded-xl bg-ok-soft border border-ok/30 px-4 py-3 text-xs sm:text-sm text-ok font-medium">
                    {statusMessage}
                  </p>
                ) : null}

                {error ? (
                  <p role="alert" className="rounded-xl bg-bad-soft border border-bad/30 px-4 py-3 text-xs sm:text-sm text-bad font-medium">
                    {error}
                  </p>
                ) : null}

                <button type="submit" className="btn btn-primary min-h-11 font-bold shadow-sm" disabled={busy}>
                  {busy
                    ? forgotMode
                      ? "Sending…"
                      : isLogin
                        ? "Signing in…"
                        : "Creating account…"
                    : forgotMode
                      ? "Send reset link"
                      : isLogin
                        ? "Sign in"
                        : "Create account"}
                </button>

                {forgotMode ? (
                  <button
                    type="button"
                    onClick={() => {
                      setForgotMode(false);
                      setError(null);
                      setStatusMessage(null);
                    }}
                    className="text-xs font-semibold text-muted hover:text-ink underline underline-offset-4 justify-self-center cursor-pointer"
                  >
                    Back to sign in
                  </button>
                ) : null}
              </form>
              <p className="text-xs sm:text-sm text-muted text-center pt-2 border-t border-line/40">
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
        </div>
      </main>
    </div>
  );
}
