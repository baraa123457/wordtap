"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/Logo";
import { CheckIcon, WindowsIcon } from "@/components/Icons";
import { getAuthRedirectUrl, getSupabase, isSupabaseConfigured } from "@/lib/supabase";

function DesktopAuthContent() {
  const searchParams = useSearchParams();
  const port = parseInt(searchParams.get("port") || "54321", 10);
  const [status, setStatus] = useState<"loading" | "redirecting" | "success" | "error">("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loopbackUrl, setLoopbackUrl] = useState<string | null>(null);
  const [authKey, setAuthKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setStatus("error");
      setErrorMessage("WordTap Supabase is not configured.");
      return;
    }

    const supabase = getSupabase();
    let active = true;

    async function syncToDesktop() {
      try {
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr) throw sessionErr;

        const session = sessionData.session;

        // If not signed in yet, initiate Google sign-in redirect
        if (!session) {
          const callbackUrl = getAuthRedirectUrl(`/auth/callback?next=${encodeURIComponent(`/auth/desktop?port=${port}`)}`);
          const { error: signInErr } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
              redirectTo: callbackUrl,
              queryParams: {
                access_type: "offline",
                prompt: "consent",
              },
            },
          });
          if (signInErr) throw signInErr;
          return;
        }

        if (!active) return;
        setStatus("redirecting");
        setEmail(session.user.email || null);

        const payload = {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in || 3600,
          expires_at: session.expires_at,
          email: session.user.email,
          user_id: session.user.id,
        };

        // Construct direct loopback navigation URL (leaves HTTPS to avoid Mixed Content block)
        const targetLoopback = `http://127.0.0.1:${port}/auth/callback#access_token=${encodeURIComponent(session.access_token)}&refresh_token=${encodeURIComponent(session.refresh_token || "")}&expires_in=${session.expires_in || 3600}&email=${encodeURIComponent(session.user.email || "")}&user_id=${encodeURIComponent(session.user.id || "")}`;
        setLoopbackUrl(targetLoopback);

        // Also prepare Base64 token payload for 1-click manual fallback
        try {
          const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
          setAuthKey(encoded);
        } catch {}

        // Navigate top-level browser directly to local loopback server
        // Browsers permit top-level navigations from HTTPS to HTTP localhost without mixed content restrictions
        try {
          window.location.replace(targetLoopback);
        } catch {
          // If window.location.replace is restricted, show the interactive button
        }

        setTimeout(() => {
          if (active) {
            setStatus("success");
          }
        }, 800);
      } catch (err) {
        if (active) {
          setStatus("error");
          setErrorMessage(err instanceof Error ? err.message : "Could not complete Desktop Player sync.");
        }
      }
    }

    void syncToDesktop();

    return () => {
      active = false;
    };
  }, [port]);

  const handleCopyKey = () => {
    if (!authKey) return;
    void navigator.clipboard?.writeText(authKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-6">
      <Logo />
      <main className="grid flex-1 content-center pb-16">
        <div className="apple-card p-6 sm:p-8 shadow-sm grid gap-5">
          {status === "error" ? (
            <>
              <div className="w-12 h-12 rounded-2xl bg-bad-soft text-bad flex items-center justify-center font-bold text-xl">
                ✕
              </div>
              <div className="grid gap-1">
                <h1 className="text-xl sm:text-2xl font-bold text-ink">Authentication issue</h1>
                <p className="text-sm text-muted">
                  {errorMessage || "Could not link your Google account to WordTap Desktop Player."}
                </p>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <Link href="/login" className="btn btn-primary w-full text-center">
                  Back to Sign In
                </Link>
                <Link href="/dashboard" className="btn btn-quiet w-full text-center">
                  Go to Web Dashboard
                </Link>
              </div>
            </>
          ) : status === "success" || status === "redirecting" ? (
            <>
              <div className="w-12 h-12 rounded-2xl bg-subtitle/15 text-subtitle flex items-center justify-center font-bold text-xl border border-subtitle/30">
                <CheckIcon size={24} />
              </div>
              <div className="grid gap-1.5">
                <h1 className="text-xl sm:text-2xl font-bold text-ink">Connected to WordTap Player!</h1>
                <p className="text-sm text-muted leading-relaxed">
                  Successfully authenticated as <strong className="text-ink font-semibold">{email}</strong>.
                  Transferring your session to WordTap VLC Desktop Player.
                </p>
              </div>

              <div className="rounded-xl bg-surface border border-line p-3 text-xs text-muted flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-subtitle shrink-0 animate-pulse" />
                <span>Redirecting to your player… Click the button below if player does not focus.</span>
              </div>

              <div className="flex flex-col gap-2.5 pt-2">
                {loopbackUrl ? (
                  <a
                    href={loopbackUrl}
                    className="btn btn-primary w-full text-center font-bold flex items-center justify-center gap-2 min-h-11 shadow-sm"
                  >
                    <WindowsIcon size={16} />
                    <span>Open WordTap Desktop Player</span>
                  </a>
                ) : null}

                {authKey ? (
                  <button
                    type="button"
                    onClick={handleCopyKey}
                    className="btn btn-quiet w-full text-center text-xs font-semibold flex items-center justify-center gap-1.5 border border-line"
                  >
                    <span>{copiedKey ? "Sign-In Key Copied!" : "Copy Sign-In Key (Fallback)"}</span>
                  </button>
                ) : null}

                <Link href="/dashboard" className="btn btn-quiet w-full text-center font-medium text-xs text-muted hover:text-ink">
                  Go to Web Dashboard
                </Link>
              </div>
            </>
          ) : (
            <div className="grid gap-3 py-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-subtitle/20 text-subtitle flex items-center justify-center mx-auto animate-pulse">
                <WindowsIcon size={22} />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-ink">Connecting to Google…</h1>
              <p className="text-xs sm:text-sm text-muted">
                Please wait while we establish your secure session with WordTap VLC Player.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function DesktopAuthPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-6">
          <Logo />
        </div>
      }
    >
      <DesktopAuthContent />
    </Suspense>
  );
}
