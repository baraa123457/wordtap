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
  const [status, setStatus] = useState<"loading" | "syncing" | "success" | "error">("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);

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
        setStatus("syncing");
        setEmail(session.user.email || null);

        const payload = {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in || 3600,
          expires_at: session.expires_at,
          email: session.user.email,
          user_id: session.user.id,
        };

        const link = `wordtap://auth?access_token=${encodeURIComponent(session.access_token)}&refresh_token=${encodeURIComponent(session.refresh_token || "")}&email=${encodeURIComponent(session.user.email || "")}&user_id=${encodeURIComponent(session.user.id || "")}`;
        setDeepLink(link);

        // Attempt HTTP loopback delivery across possible ports
        const candidatePorts = [port, 54321, 54322, 54323, 54324, 54325];

        for (const p of candidatePorts) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const res = await fetch(`http://127.0.0.1:${p}/auth-exchange`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.ok) {
              break;
            }
          } catch {
            // Try next candidate port
          }
        }

        // Also trigger the deep link protocol for seamless OS-level handoff
        try {
          window.location.href = link;
        } catch {
          // Ignore deep link redirection error if blocked
        }

        if (active) {
          setStatus("success");
        }
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
          ) : status === "success" ? (
            <>
              <div className="w-12 h-12 rounded-2xl bg-ok-soft text-ok flex items-center justify-center font-bold text-xl border border-ok/30">
                <CheckIcon size={24} />
              </div>
              <div className="grid gap-1.5">
                <h1 className="text-xl sm:text-2xl font-bold text-ink">Connected to WordTap Player!</h1>
                <p className="text-sm text-muted leading-relaxed">
                  Successfully authenticated as <strong className="text-ink font-semibold">{email}</strong>.
                  Your session has synced to WordTap VLC Desktop Player.
                </p>
              </div>

              <div className="rounded-xl bg-surface border border-line p-3 text-xs text-muted flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-ok shrink-0 animate-pulse" />
                <span>You can now close this browser tab and return to the player.</span>
              </div>

              <div className="flex flex-col gap-2.5 pt-2">
                {deepLink ? (
                  <a
                    href={deepLink}
                    className="btn btn-primary w-full text-center font-bold flex items-center justify-center gap-2"
                  >
                    <WindowsIcon size={16} />
                    <span>Open WordTap Desktop Player</span>
                  </a>
                ) : null}
                <Link href="/dashboard" className="btn btn-quiet w-full text-center font-medium">
                  Go to Web Dashboard
                </Link>
              </div>
            </>
          ) : (
            <div className="grid gap-3 py-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-subtitle/20 text-subtitle flex items-center justify-center mx-auto animate-pulse">
                <WindowsIcon size={22} />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-ink">
                {status === "syncing" ? "Syncing with Desktop Player…" : "Connecting to Google…"}
              </h1>
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
